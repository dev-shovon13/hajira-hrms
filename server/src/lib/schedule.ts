import type { HalfDaySession, Shift } from '@prisma/client';
import type { ShiftDto } from '@hajira/shared';
import { prisma } from '@/lib/prisma';
import { dateStr, dbDate, eachDate, toHHmm, weekday, zonedInstant } from '@/lib/time';

/** Fallback when nothing is configured: 09:00–18:00, Fri/Sat off (Bangladesh week). */
export const FALLBACK_SHIFT: Shift = {
  id: 'fallback',
  name: 'General',
  type: 'FIXED',
  startMinutes: 9 * 60,
  endMinutes: 18 * 60,
  graceMinutes: 15,
  earlyLeaveGraceMinutes: 0,
  halfDayMinutes: 240,
  weeklyOffDays: [5, 6],
  isDefault: true,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export function toShiftDto(shift: Shift, assignedCount?: number): ShiftDto {
  return {
    id: shift.id,
    name: shift.name,
    type: shift.type,
    startTime: toHHmm(shift.startMinutes),
    endTime: toHHmm(shift.endMinutes),
    graceMinutes: shift.graceMinutes,
    earlyLeaveGraceMinutes: shift.earlyLeaveGraceMinutes,
    halfDayMinutes: shift.halfDayMinutes,
    weeklyOffDays: shift.weeklyOffDays,
    isDefault: shift.isDefault,
    ...(assignedCount !== undefined ? { assignedCount } : {}),
  };
}

export const crossesMidnight = (s: Shift) => s.endMinutes <= s.startMinutes;

/** Scheduled length in minutes (night shifts wrap past midnight). */
export function shiftLength(s: Shift) {
  return crossesMidnight(s) ? s.endMinutes + 1440 - s.startMinutes : s.endMinutes - s.startMinutes;
}

export function isOffDay(s: Shift, date: string) {
  return s.weeklyOffDays.includes(weekday(date));
}

/** UTC instants for the shift on a local date. */
export function shiftWindow(s: Shift, date: string, tz: string) {
  const endMinutes = crossesMidnight(s) ? s.endMinutes + 1440 : s.endMinutes;
  return {
    start: zonedInstant(date, s.startMinutes, tz),
    graceEnd: zonedInstant(date, s.startMinutes + s.graceMinutes, tz),
    end: zonedInstant(date, endMinutes, tz),
  };
}

/**
 * Resolves each user's shift on a date: explicit assignment effective on that
 * date → their department's default shift → the company default shift.
 */
export async function resolveShifts(userIds: string[], date: string) {
  const day = dbDate(date);
  const [assignments, users, fallback] = await Promise.all([
    prisma.employeeShift.findMany({
      where: {
        userId: { in: userIds },
        effectiveFrom: { lte: day },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
        shift: { isActive: true },
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { shift: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, department: { select: { defaultShift: true } } },
    }),
    prisma.shift.findFirst({ where: { isDefault: true, isActive: true } }),
  ]);

  const map = new Map<string, Shift>();
  for (const a of assignments) if (!map.has(a.userId)) map.set(a.userId, a.shift);
  for (const u of users) {
    if (map.has(u.id)) continue;
    const dept = u.department?.defaultShift;
    map.set(u.id, dept && dept.isActive ? dept : (fallback ?? FALLBACK_SHIFT));
  }
  return map;
}

export async function shiftFor(userId: string, date: string) {
  return (await resolveShifts([userId], date)).get(userId) ?? FALLBACK_SHIFT;
}

export async function holidaysBetween(from: string, to: string) {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: dbDate(from), lte: dbDate(to) } },
    select: { date: true, name: true },
    orderBy: { date: 'asc' },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    const key = dateStr(r.date);
    map.set(key, map.has(key) ? `${map.get(key)} · ${r.name}` : r.name);
  }
  return map;
}

export interface LeaveDayInfo {
  requestId: string;
  type: string;
  code: string;
  isHalfDay: boolean;
  session: HalfDaySession | null;
  pending: boolean;
}

/** Approved (and optionally pending) leave per user per date in a range. */
export async function leavesBetween(userIds: string[] | null, from: string, to: string, includePending = false) {
  const rows = await prisma.leaveRequest.findMany({
    where: {
      ...(userIds ? { userId: { in: userIds } } : {}),
      status: includePending ? { in: ['APPROVED', 'PENDING'] } : 'APPROVED',
      startDate: { lte: dbDate(to) },
      endDate: { gte: dbDate(from) },
    },
    select: {
      id: true,
      userId: true,
      startDate: true,
      endDate: true,
      isHalfDay: true,
      halfDaySession: true,
      status: true,
      leaveType: { select: { name: true, code: true } },
    },
  });
  const map = new Map<string, Map<string, LeaveDayInfo>>();
  for (const r of rows) {
    const start = dateStr(r.startDate) < from ? from : dateStr(r.startDate);
    const end = dateStr(r.endDate) > to ? to : dateStr(r.endDate);
    const userMap = map.get(r.userId) ?? new Map<string, LeaveDayInfo>();
    for (const d of eachDate(start, end)) {
      // Approved wins over pending when both touch a date.
      const existing = userMap.get(d);
      if (existing && !existing.pending) continue;
      userMap.set(d, {
        requestId: r.id,
        type: r.leaveType.name,
        code: r.leaveType.code,
        isHalfDay: r.isHalfDay,
        session: r.halfDaySession,
        pending: r.status === 'PENDING',
      });
    }
    map.set(r.userId, userMap);
  }
  return map;
}
