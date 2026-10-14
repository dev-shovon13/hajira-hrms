import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { notify } from '@/lib/notify';
import { emails } from '@/emails/templates';
import { addDaysStr, dateStr, dbDate, formatClock, formatHuman, localDate, monthRange } from '@/lib/time';
import { holidaysBetween, isOffDay, leavesBetween, resolveShifts } from '@/lib/schedule';
import { dayContext } from '@/modules/attendance/service';
import { evaluate, expectedWindow } from '@/modules/attendance/engine';
import { ensureBalances } from '@/modules/leave/balances';

/**
 * Settles a finished day: every active employee without a record gets one.
 * Absent only when there was no check-in, no approved leave, no holiday and
 * it was a working day for their shift.
 */
export async function closeDay(date?: string) {
  const { timezone: tz } = await getSettings();
  const day = date ?? addDaysStr(localDate(new Date(), tz), -1);
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ joinDate: null }, { joinDate: { lte: dbDate(day) } }],
      attendance: { none: { date: dbDate(day) } },
    },
    select: { id: true },
  });
  if (users.length === 0) return { date: day, created: 0 };
  const ids = users.map((u) => u.id);
  const [shifts, holidays, leaves] = await Promise.all([resolveShifts(ids, day), holidaysBetween(day, day), leavesBetween(ids, day, day)]);

  const rows = ids.map((userId) => {
    const shift = shifts.get(userId)!;
    const leave = leaves.get(userId)?.get(day);
    const status = holidays.has(day)
      ? ('HOLIDAY' as const)
      : isOffDay(shift, day)
        ? ('WEEKEND' as const)
        : leave
          ? ('ON_LEAVE' as const)
          : ('ABSENT' as const);
    return { userId, date: dbDate(day), status, shiftId: shift.id === 'fallback' ? null : shift.id };
  });
  const { count } = await prisma.attendance.createMany({ data: rows, skipDuplicates: true });
  return { date: day, created: count, absent: rows.filter((r) => r.status === 'ABSENT').length };
}

/**
 * Closes check-ins nobody checked out of. Runs every 15 minutes; a day is
 * closed at its shift end once `autoCloseAfterMinutes` have passed, then
 * flagged so HR or the employee can correct it.
 */
export async function autoCloseOpenDays(now = new Date()) {
  const { timezone: tz, autoCloseAfterMinutes } = await getSettings();
  const today = localDate(now, tz);
  const open = await prisma.attendance.findMany({
    where: { checkIn: { not: null }, checkOut: null, date: { gte: dbDate(addDaysStr(today, -3)) } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  let closed = 0;
  for (const rec of open) {
    const date = dateStr(rec.date);
    const ctx = await dayContext(rec.userId, date, tz);
    const { end } = expectedWindow(ctx);
    if (now.getTime() < end.getTime() + autoCloseAfterMinutes * 60_000) continue;

    const checkOut = rec.checkIn! > end ? rec.checkIn! : end;
    const result = evaluate(ctx, rec.checkIn, checkOut);
    await prisma.attendance.update({
      where: { id: rec.id },
      data: { checkOut, ...result, autoClosed: true, isFlagged: true, flagReason: 'Missing check-out: closed at shift end' },
    });
    const closedAt = formatClock(checkOut, tz);
    await notify({
      userId: rec.userId,
      type: 'MISSING_CHECKOUT',
      title: 'You forgot to check out',
      body: `${formatHuman(date)} was closed at ${closedAt} and flagged. Request a correction if you left at a different time.`,
      link: '/attendance?regularize=1',
      email: emails.missingCheckout(rec.user.email, rec.user.name, formatHuman(date), closedAt),
    });
    closed++;
  }
  return { checked: open.length, closed };
}

/** "Every X late marks deduct one leave day", for the previous month (or a given YYYY-MM). */
export async function applyLatePolicy(month?: string) {
  const { timezone: tz, latePolicy } = await getSettings();
  if (!latePolicy.enabled) return { skipped: 'late policy disabled' };
  const target = month ?? addDaysStr(`${localDate(new Date(), tz).slice(0, 7)}-01`, -1).slice(0, 7);
  const { start, end } = monthRange(target);
  const [year, mon] = target.split('-').map(Number);

  const leaveType = await prisma.leaveType.findUnique({ where: { code: latePolicy.deductLeaveTypeCode } });
  const counts = await prisma.attendance.groupBy({
    by: ['userId'],
    where: { status: 'LATE', date: { gte: dbDate(start), lte: dbDate(end) }, user: { deletedAt: null } },
    _count: { _all: true },
  });

  let penalized = 0;
  for (const c of counts) {
    const days = Math.floor(c._count._all / latePolicy.lateMarksPerDeduction);
    if (days === 0) continue;
    const exists = await prisma.latePenalty.findUnique({ where: { userId_year_month: { userId: c.userId, year, month: mon } } });
    if (exists) continue;

    await prisma.$transaction(async (tx) => {
      await tx.latePenalty.create({
        data: { userId: c.userId, year, month: mon, lateCount: c._count._all, daysDeducted: days, leaveTypeId: leaveType?.id },
      });
      if (leaveType) {
        await ensureBalances(c.userId, year, tx);
        await tx.leaveBalance.update({
          where: { userId_leaveTypeId_year: { userId: c.userId, leaveTypeId: leaveType.id, year } },
          data: { adjusted: { decrement: days } },
        });
      }
      await tx.auditLog.create({
        data: { action: 'leave.late_penalty', entity: 'User', entityId: c.userId, after: { month: target, lateCount: c._count._all, days } },
      });
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: c.userId }, select: { name: true, email: true } });
    const typeName = leaveType?.name ?? 'leave';
    await notify({
      userId: c.userId,
      type: 'LATE_PENALTY',
      title: `${days} ${typeName.toLowerCase()} day${days === 1 ? '' : 's'} deducted`,
      body: `${c._count._all} late marks in ${target}. Every ${latePolicy.lateMarksPerDeduction} late marks cost one day.`,
      link: '/leave',
      email: emails.latePenalty(user.email, user.name, target, c._count._all, days, typeName),
    });
    penalized++;
  }
  return { month: target, penalized };
}

/** Opens the new leave year for everyone (carry-forward computed in ensureBalances). */
export async function rollLeaveYear(year = new Date().getFullYear()) {
  const users = await prisma.user.findMany({ where: { deletedAt: null, status: { in: ['ACTIVE', 'INVITED'] } }, select: { id: true } });
  for (const u of users) await ensureBalances(u.id, year);
  return { year, users: users.length };
}
