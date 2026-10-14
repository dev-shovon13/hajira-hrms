import type { Attendance, Prisma } from '@prisma/client';
import type { z } from 'zod';
import type {
  AttendanceDto,
  AttendanceEditInput,
  MonthDay,
  MonthSummary,
  TodayDto,
  attendanceListQuery,
} from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { emails } from '@/emails/templates';
import { AppError } from '@/utils/AppError';
import { pageArgs } from '@/utils/response';
import {
  addDaysStr,
  dateStr,
  dbDate,
  eachDate,
  formatClock,
  localDate,
  monthRange,
  currentMonth,
} from '@/lib/time';
import { holidaysBetween, isOffDay, leavesBetween, resolveShifts, shiftFor, toShiftDto } from '@/lib/schedule';
import { visibleUsersWhere } from '@/modules/users/service';
import { attendanceDate, evaluate, expectedWindow, ipAllowed, type DayContext } from './engine';

type Actor = Express.AuthUser;

const userSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  employeeCode: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

type WithUser = Attendance & { user?: Prisma.UserGetPayload<{ select: typeof userSelect }> };

export function toDto(a: WithUser): AttendanceDto {
  return {
    id: a.id,
    date: dateStr(a.date),
    checkIn: a.checkIn?.toISOString() ?? null,
    checkOut: a.checkOut?.toISOString() ?? null,
    status: a.status,
    lateMinutes: a.lateMinutes,
    earlyLeaveMinutes: a.earlyLeaveMinutes,
    workMinutes: a.workMinutes,
    overtimeMinutes: a.overtimeMinutes,
    isFlagged: a.isFlagged,
    flagReason: a.flagReason,
    autoClosed: a.autoClosed,
    note: a.note,
    ...(a.user ? { user: a.user } : {}),
  };
}

/** Full context for one employee-day: shift, holiday, weekly off, half-day leave. */
export async function dayContext(userId: string, date: string, tz: string): Promise<DayContext & { holidayName: string | null; leave: { type: string; isHalfDay: boolean } | null }> {
  const [shift, holidays, leaves] = await Promise.all([
    shiftFor(userId, date),
    holidaysBetween(date, date),
    leavesBetween([userId], date, date),
  ]);
  const leave = leaves.get(userId)?.get(date) ?? null;
  return {
    date,
    shift,
    tz,
    isOffDay: isOffDay(shift, date),
    isHoliday: holidays.has(date),
    holidayName: holidays.get(date) ?? null,
    halfDayLeave: leave?.isHalfDay ? leave.session : null,
    leave: leave ? { type: leave.type, isHalfDay: leave.isHalfDay } : null,
  };
}

async function currentDay(userId: string, tz: string, now = new Date()) {
  const today = localDate(now, tz);
  const shifts = await Promise.all([shiftFor(userId, today), shiftFor(userId, addDaysStr(today, -1))]);
  const { date } = attendanceDate(now, shifts[0], shifts[1], tz);
  return dayContext(userId, date, tz);
}

export async function today(actor: Actor, ip?: string): Promise<TodayDto> {
  const settings = await getSettings();
  const tz = settings.timezone;
  const ctx = await currentDay(actor.id, tz);
  const record = await prisma.attendance.findUnique({ where: { userId_date: { userId: actor.id, date: dbDate(ctx.date) } } });
  const win = expectedWindow(ctx);
  const allowed = !settings.ipRestriction.enabled || ipAllowed(ip, settings.ipRestriction.allowedIps);
  return {
    date: ctx.date,
    serverTime: new Date().toISOString(),
    timezone: tz,
    shift: toShiftDto(ctx.shift),
    window: { start: win.start.toISOString(), graceEnd: win.graceEnd.toISOString(), end: win.end.toISOString() },
    dayType: ctx.isHoliday ? 'HOLIDAY' : ctx.leave && !ctx.leave.isHalfDay ? 'LEAVE' : ctx.isOffDay ? 'WEEKEND' : 'WORKDAY',
    holiday: ctx.holidayName ? { name: ctx.holidayName } : null,
    leave: ctx.leave,
    attendance: record ? toDto(record) : null,
    canCheckIn: !record?.checkIn,
    canCheckOut: Boolean(record?.checkIn && !record.checkOut),
    ipAllowed: allowed,
  };
}

async function assertIp(ip: string | undefined) {
  const { ipRestriction } = await getSettings();
  if (ipRestriction.enabled && !ipAllowed(ip, ipRestriction.allowedIps)) {
    throw AppError.forbidden('Check-in is only allowed from the office network', 'IP_NOT_ALLOWED');
  }
}

export async function checkIn(actor: Actor, ip?: string) {
  await assertIp(ip);
  const { timezone: tz, latePolicy } = await getSettings();
  const now = new Date(); // the server clock is the only clock that counts
  const ctx = await currentDay(actor.id, tz, now);
  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: actor.id, date: dbDate(ctx.date) } } });
  if (existing?.checkIn) {
    throw AppError.conflict(`You already checked in at ${formatClock(existing.checkIn, tz)}`, 'ALREADY_CHECKED_IN');
  }

  const result = evaluate(ctx, now, null);
  let record: Attendance;
  try {
    record = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: { checkIn: now, checkInIp: ip, shiftId: ctx.shift.id === 'fallback' ? null : ctx.shift.id, ...result },
        })
      : await prisma.attendance.create({
          data: {
            userId: actor.id,
            date: dbDate(ctx.date),
            checkIn: now,
            checkInIp: ip,
            shiftId: ctx.shift.id === 'fallback' ? null : ctx.shift.id,
            ...result,
          },
        });
  } catch (err) {
    // Two taps racing: the (userId, date) unique constraint lets only one through.
    if ((err as { code?: string }).code === 'P2002') throw AppError.conflict('You already checked in today', 'ALREADY_CHECKED_IN');
    throw err;
  }

  if (record.status === 'LATE') {
    const { start, end } = monthRange(ctx.date.slice(0, 7));
    const count = await prisma.attendance.count({
      where: { userId: actor.id, status: 'LATE', date: { gte: dbDate(start), lte: dbDate(end) } },
    });
    const threshold = latePolicy.enabled ? latePolicy.lateMarksPerDeduction : null;
    const time = formatClock(now, tz);
    await notify({
      userId: actor.id,
      type: 'LATE_WARNING',
      title: `Late by ${record.lateMinutes} min`,
      body: threshold
        ? `Checked in at ${time}. Late mark ${count} this month; every ${threshold} cost a leave day.`
        : `Checked in at ${time}. Late mark ${count} this month.`,
      link: '/attendance',
      email: emails.lateWarning(actor.email, actor.name, time, record.lateMinutes, count, threshold),
    });
  }
  return toDto(record);
}

export async function checkOut(actor: Actor, ip?: string) {
  await assertIp(ip);
  const { timezone: tz } = await getSettings();
  const now = new Date();
  const today = localDate(now, tz);

  // The open record may belong to yesterday (night shift).
  const open = await prisma.attendance.findFirst({
    where: { userId: actor.id, checkIn: { not: null }, checkOut: null, date: { gte: dbDate(addDaysStr(today, -1)), lte: dbDate(today) } },
    orderBy: { date: 'desc' },
  });
  if (!open) {
    const done = await prisma.attendance.findUnique({ where: { userId_date: { userId: actor.id, date: dbDate(today) } } });
    if (done?.checkOut) throw AppError.conflict(`You already checked out at ${formatClock(done.checkOut, tz)}`, 'ALREADY_CHECKED_OUT');
    throw AppError.badRequest('Check in first', 'NOT_CHECKED_IN');
  }

  const ctx = await dayContext(actor.id, dateStr(open.date), tz);
  const result = evaluate(ctx, open.checkIn, now);
  const record = await prisma.attendance.update({
    where: { id: open.id },
    data: { checkOut: now, checkOutIp: ip, ...result },
  });
  return toDto(record);
}

// ---------- month view ----------

export async function month(userId: string, monthStr: string | undefined): Promise<MonthSummary> {
  const { timezone: tz } = await getSettings();
  const month = monthStr ?? currentMonth(tz);
  const { start, end } = monthRange(month);
  const today = localDate(new Date(), tz);

  const [user, records, holidays, leaves, shiftsByDate] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { joinDate: true, createdAt: true } }),
    prisma.attendance.findMany({ where: { userId, date: { gte: dbDate(start), lte: dbDate(end) } } }),
    holidaysBetween(start, end),
    leavesBetween([userId], start, end, true),
    // Shift changes mid-month are rare; resolve at both ends and per-date only when they differ.
    Promise.all([shiftFor(userId, start), shiftFor(userId, end)]),
  ]);
  const byDate = new Map(records.map((r) => [dateStr(r.date), r]));
  const userLeaves = leaves.get(userId);
  const joined = user.joinDate ? dateStr(user.joinDate) : dateStr(user.createdAt);
  const sameShift = shiftsByDate[0].id === shiftsByDate[1].id;

  const totals = { PRESENT: 0, LATE: 0, ABSENT: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0, WEEKEND: 0, workingDays: 0, workMinutes: 0, overtimeMinutes: 0 };
  const days: MonthDay[] = [];

  for (const date of eachDate(start, end)) {
    const shift = sameShift ? shiftsByDate[0] : await shiftFor(userId, date);
    const rec = byDate.get(date);
    const leave = userLeaves?.get(date);
    const holiday = holidays.get(date) ?? null;
    const off = isOffDay(shift, date);
    const isFuture = date > today;
    const isToday = date === today;

    let status: MonthDay['status'] = null;
    let pending = false;
    let label: string | null = holiday;

    if (rec) {
      status = rec.status;
      pending = isToday && !rec.checkOut;
    } else if (holiday) status = 'HOLIDAY';
    else if (off) status = 'WEEKEND';
    else if (leave) {
      status = 'ON_LEAVE';
      pending = leave.pending;
      label = leave.type;
    } else if (isToday) pending = true;
    else if (!isFuture && date >= joined) status = 'ABSENT';

    if (leave && !label) label = leave.type;
    if (!isFuture && status && !(isToday && pending)) totals[status] += 1;
    if (!holiday && !off && date <= today && date >= joined) totals.workingDays += 1;
    if (rec) {
      totals.workMinutes += rec.workMinutes;
      totals.overtimeMinutes += rec.overtimeMinutes;
    }

    days.push({
      date,
      status: isFuture && status !== 'HOLIDAY' && status !== 'WEEKEND' && status !== 'ON_LEAVE' ? null : status,
      pending: pending || (isFuture && Boolean(leave?.pending)),
      isToday,
      isFuture,
      checkIn: rec?.checkIn?.toISOString() ?? null,
      checkOut: rec?.checkOut?.toISOString() ?? null,
      workMinutes: rec?.workMinutes ?? 0,
      lateMinutes: rec?.lateMinutes ?? 0,
      label,
    });
  }
  return { month, days, totals };
}

// ---------- lists & edits ----------

export async function list(actor: Actor, q: z.infer<typeof attendanceListQuery>) {
  const where: Prisma.AttendanceWhereInput = {
    user: {
      AND: [
        visibleUsersWhere(actor),
        q.departmentId ? { departmentId: q.departmentId } : {},
        q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { employeeCode: { contains: q.search, mode: 'insensitive' } }] } : {},
      ],
    },
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.flagged ? { isFlagged: q.flagged === 'true' } : {}),
    ...(q.from || q.to ? { date: { ...(q.from ? { gte: dbDate(q.from) } : {}), ...(q.to ? { lte: dbDate(q.to) } : {}) } } : {}),
  };
  const orderBy: Prisma.AttendanceOrderByWithRelationInput[] =
    q.sort === 'name'
      ? [{ user: { name: q.order } }, { date: 'desc' }]
      : q.sort === 'lateMinutes'
        ? [{ lateMinutes: q.order }]
        : q.sort === 'workMinutes'
          ? [{ workMinutes: q.order }]
          : q.sort === 'checkIn'
            ? [{ checkIn: q.order }]
            : [{ date: q.order }, { user: { name: 'asc' } }];
  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({ where, include: { user: { select: userSelect } }, orderBy, ...pageArgs(q) }),
    prisma.attendance.count({ where }),
  ]);
  return { rows: rows.map(toDto), total };
}

export async function edit(actor: Actor, id: string, input: AttendanceEditInput, ip?: string) {
  const before = await prisma.attendance.findUnique({ where: { id } });
  if (!before) throw AppError.notFound('Attendance record');
  const { timezone: tz } = await getSettings();
  const ctx = await dayContext(before.userId, dateStr(before.date), tz);

  const checkIn = input.checkIn === undefined ? before.checkIn : input.checkIn ? new Date(input.checkIn) : null;
  const checkOut = input.checkOut === undefined ? before.checkOut : input.checkOut ? new Date(input.checkOut) : null;
  if (checkIn && checkOut && checkOut <= checkIn) {
    throw AppError.unprocessable('Check-out must be after check-in', 'BAD_TIMES', { checkOut: ['Must be after check-in'] });
  }
  const computed = evaluate(ctx, checkIn, checkOut);
  const after = await prisma.attendance.update({
    where: { id },
    data: {
      checkIn,
      checkOut,
      ...computed,
      status: input.status ?? computed.status,
      isFlagged: false,
      flagReason: null,
      note: input.note,
    },
  });
  await audit({ actorId: actor.id, action: 'attendance.edit', entity: 'Attendance', entityId: id, before: toDto(before), after: toDto(after), ip });
  return toDto(after);
}

/** Team snapshot for a date (manager + HR dashboards). */
export async function teamToday(userIds: string[], tz: string) {
  const today = localDate(new Date(), tz);
  const [records, shifts, holidays, leaves] = await Promise.all([
    prisma.attendance.findMany({ where: { userId: { in: userIds }, date: dbDate(today) } }),
    resolveShifts(userIds, today),
    holidaysBetween(today, today),
    leavesBetween(userIds, today, today),
  ]);
  const byUser = new Map(records.map((r) => [r.userId, r]));
  return userIds.map((id) => {
    const rec = byUser.get(id);
    const shift = shifts.get(id)!;
    const leave = leaves.get(id)?.get(today);
    let status: TodayStatus;
    if (rec) status = rec.status;
    else if (holidays.has(today)) status = 'HOLIDAY';
    else if (isOffDay(shift, today)) status = 'WEEKEND';
    else if (leave && !leave.isHalfDay) status = 'ON_LEAVE';
    else status = 'NOT_IN';
    return { userId: id, status, checkIn: rec?.checkIn ?? null, lateMinutes: rec?.lateMinutes ?? 0 };
  });
}

type TodayStatus = Attendance['status'] | 'NOT_IN';
