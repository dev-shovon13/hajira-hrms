import type { AttendanceStatus, Prisma } from '@prisma/client';
import type { LateReportRow, LeaveReportRow, MonthlySheetDto, MonthlySheetRow } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { currentMonth, dateStr, dbDate, eachDate, localDate, monthRange } from '@/lib/time';
import { holidaysBetween, isOffDay, leavesBetween, resolveShifts } from '@/lib/schedule';
import { visibleUsersWhere } from '@/modules/users/service';

type Actor = Express.AuthUser;

export interface ReportFilters {
  from?: string;
  to?: string;
  month?: string;
  departmentId?: string;
  userId?: string;
}

function userWhere(actor: Actor, f: ReportFilters): Prisma.UserWhereInput {
  return {
    AND: [
      visibleUsersWhere(actor),
      { status: { in: ['ACTIVE', 'SUSPENDED'] } },
      f.departmentId ? { departmentId: f.departmentId } : {},
      f.userId ? { id: f.userId } : {},
    ],
  };
}

export async function monthlySheet(actor: Actor, f: ReportFilters): Promise<MonthlySheetDto> {
  const { timezone: tz } = await getSettings();
  const month = f.month ?? currentMonth(tz);
  const { start, end } = monthRange(month);
  const today = localDate(new Date(), tz);
  const dates = eachDate(start, end);

  const users = await prisma.user.findMany({
    where: userWhere(actor, f),
    select: { id: true, name: true, employeeCode: true, joinDate: true, createdAt: true, department: { select: { name: true } } },
    orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    take: 500,
  });
  const ids = users.map((u) => u.id);
  const [records, holidays, leaves, shifts] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: { in: ids }, date: { gte: dbDate(start), lte: dbDate(end) } },
      select: { userId: true, date: true, status: true, workMinutes: true },
    }),
    holidaysBetween(start, end),
    leavesBetween(ids, start, end),
    resolveShifts(ids, start),
  ]);
  const rec = new Map(records.map((r) => [`${r.userId}|${dateStr(r.date)}`, r]));

  const rows: MonthlySheetRow[] = users.map((u) => {
    const joined = u.joinDate ? dateStr(u.joinDate) : dateStr(u.createdAt);
    const totals = { present: 0, late: 0, absent: 0, halfDay: 0, leave: 0, holiday: 0, weekend: 0, workHours: 0 };
    const days = dates.map((d): AttendanceStatus | null => {
      const r = rec.get(`${u.id}|${d}`);
      let s: AttendanceStatus | null = null;
      if (r) {
        s = r.status;
        totals.workHours += r.workMinutes / 60;
      } else if (holidays.has(d)) s = 'HOLIDAY';
      else if (isOffDay(shifts.get(u.id)!, d)) s = 'WEEKEND';
      else if (leaves.get(u.id)?.has(d)) s = 'ON_LEAVE';
      else if (d < today && d >= joined) s = 'ABSENT';
      if (s === 'PRESENT') totals.present++;
      else if (s === 'LATE') totals.late++;
      else if (s === 'ABSENT') totals.absent++;
      else if (s === 'HALF_DAY') totals.halfDay++;
      else if (s === 'ON_LEAVE') totals.leave++;
      else if (s === 'HOLIDAY') totals.holiday++;
      else if (s === 'WEEKEND') totals.weekend++;
      return s;
    });
    totals.workHours = Math.round(totals.workHours * 10) / 10;
    return {
      user: { id: u.id, name: u.name, employeeCode: u.employeeCode, department: u.department?.name ?? null },
      days,
      totals,
    };
  });
  return { month, dates, rows };
}

function range(f: ReportFilters, tz: string) {
  if (f.from || f.to) {
    const today = localDate(new Date(), tz);
    return { from: f.from ?? `${today.slice(0, 7)}-01`, to: f.to ?? today };
  }
  const { start, end } = monthRange(f.month ?? currentMonth(tz));
  return { from: start, to: end };
}

export async function lateReport(actor: Actor, f: ReportFilters, page?: { skip: number; take: number }) {
  const { timezone: tz } = await getSettings();
  const { from, to } = range(f, tz);
  const where: Prisma.AttendanceWhereInput = {
    status: 'LATE',
    date: { gte: dbDate(from), lte: dbDate(to) },
    user: userWhere(actor, f),
  };
  const [rows, total, summary] = await Promise.all([
    prisma.attendance.findMany({
      where,
      select: {
        id: true,
        date: true,
        checkIn: true,
        lateMinutes: true,
        user: { select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } } },
      },
      orderBy: [{ date: 'desc' }, { lateMinutes: 'desc' }],
      ...(page ?? { skip: 0, take: 5000 }),
    }),
    prisma.attendance.count({ where }),
    prisma.attendance.aggregate({ where, _avg: { lateMinutes: true }, _sum: { lateMinutes: true } }),
  ]);
  const data: LateReportRow[] = rows.map((r) => ({
    id: r.id,
    date: dateStr(r.date),
    checkIn: r.checkIn!.toISOString(),
    lateMinutes: r.lateMinutes,
    user: { id: r.user.id, name: r.user.name, employeeCode: r.user.employeeCode, department: r.user.department?.name ?? null },
  }));
  return {
    from,
    to,
    rows: data,
    total,
    summary: { averageMinutes: Math.round(summary._avg.lateMinutes ?? 0), totalMinutes: summary._sum.lateMinutes ?? 0 },
  };
}

export async function leaveReport(actor: Actor, f: ReportFilters, page?: { skip: number; take: number }) {
  const { timezone: tz } = await getSettings();
  const { from, to } = range(f, tz);
  const where: Prisma.LeaveRequestWhereInput = {
    startDate: { lte: dbDate(to) },
    endDate: { gte: dbDate(from) },
    status: { in: ['APPROVED', 'PENDING', 'REJECTED'] },
    user: userWhere(actor, f),
  };
  const [rows, total, byType] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        days: true,
        status: true,
        leaveType: { select: { name: true } },
        user: { select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } } },
      },
      orderBy: { startDate: 'desc' },
      ...(page ?? { skip: 0, take: 5000 }),
    }),
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.groupBy({ by: ['leaveTypeId'], where: { ...where, status: 'APPROVED' }, _sum: { days: true } }),
  ]);
  const types = await prisma.leaveType.findMany({ where: { id: { in: byType.map((b) => b.leaveTypeId) } }, select: { id: true, name: true } });
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const data: LeaveReportRow[] = rows.map((r) => ({
    id: r.id,
    startDate: dateStr(r.startDate),
    endDate: dateStr(r.endDate),
    days: r.days,
    status: r.status,
    leaveType: r.leaveType.name,
    user: { id: r.user.id, name: r.user.name, employeeCode: r.user.employeeCode, department: r.user.department?.name ?? null },
  }));
  return {
    from,
    to,
    rows: data,
    total,
    summary: byType.map((b) => ({ leaveType: typeName.get(b.leaveTypeId) ?? '—', days: b._sum.days ?? 0 })),
  };
}
