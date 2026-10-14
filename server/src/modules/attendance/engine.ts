import type { AttendanceStatus, HalfDaySession, Shift } from '@prisma/client';
import { addDaysStr, localDate, localMinutes, minutesBetween } from '@/lib/time';
import { crossesMidnight, shiftLength, shiftWindow } from '@/lib/schedule';

/**
 * Pure attendance rules. Everything that decides a day's status lives here so
 * check-in, check-out, regularization, HR edits and the nightly job agree.
 */

export interface DayContext {
  date: string;
  shift: Shift;
  tz: string;
  isOffDay: boolean;
  isHoliday: boolean;
  /** Approved half-day leave on this date shifts the expected window. */
  halfDayLeave: HalfDaySession | null;
}

export interface Evaluation {
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
}

export function expectedWindow(ctx: DayContext) {
  const win = shiftWindow(ctx.shift, ctx.date, ctx.tz);
  const half = Math.round(shiftLength(ctx.shift) / 2) * 60_000;
  let start = win.start;
  let end = win.end;
  if (ctx.halfDayLeave === 'FIRST_HALF') start = new Date(win.start.getTime() + half);
  if (ctx.halfDayLeave === 'SECOND_HALF') end = new Date(win.start.getTime() + half);
  return { start, end, graceEnd: new Date(start.getTime() + ctx.shift.graceMinutes * 60_000) };
}

export function evaluate(ctx: DayContext, checkIn: Date | null, checkOut: Date | null): Evaluation {
  if (!checkIn) {
    return {
      status: ctx.isHoliday ? 'HOLIDAY' : ctx.isOffDay ? 'WEEKEND' : 'ABSENT',
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workMinutes: 0,
      overtimeMinutes: 0,
    };
  }

  const nonWorking = ctx.isOffDay || ctx.isHoliday;
  const flexible = ctx.shift.type === 'FLEXIBLE';
  const { start, end, graceEnd } = expectedWindow(ctx);

  const lateMinutes = !nonWorking && !flexible && checkIn > graceEnd ? minutesBetween(start, checkIn) : 0;
  let status: AttendanceStatus = lateMinutes > 0 ? 'LATE' : 'PRESENT';
  let workMinutes = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;

  if (checkOut) {
    workMinutes = Math.max(0, minutesBetween(checkIn, checkOut));
    const earlyCutoff = new Date(end.getTime() - ctx.shift.earlyLeaveGraceMinutes * 60_000);
    earlyLeaveMinutes = !nonWorking && !flexible && checkOut < earlyCutoff ? minutesBetween(checkOut, end) : 0;
    const expected = ctx.halfDayLeave ? shiftLength(ctx.shift) / 2 : shiftLength(ctx.shift);
    overtimeMinutes = nonWorking ? workMinutes : Math.max(0, Math.round(workMinutes - expected));
    if (!nonWorking && !ctx.halfDayLeave && workMinutes < ctx.shift.halfDayMinutes) status = 'HALF_DAY';
  }

  return { status, lateMinutes, earlyLeaveMinutes, workMinutes, overtimeMinutes };
}

/**
 * The calendar date a check-in belongs to. Night shifts that started yesterday
 * own the early hours of today.
 */
export function attendanceDate(now: Date, todaysShift: Shift, yesterdaysShift: Shift, tz: string) {
  const today = localDate(now, tz);
  const minutes = localMinutes(now, tz);
  if (crossesMidnight(yesterdaysShift) && minutes < yesterdaysShift.endMinutes + 120) {
    return { date: addDaysStr(today, -1), shift: yesterdaysShift };
  }
  return { date: today, shift: todaysShift };
}

/** Exact IPs, or prefixes ending in "*" (e.g. 103.48.16.*). */
export function ipAllowed(ip: string | undefined, allowed: string[]) {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, '');
  return allowed.some((rule) => (rule.endsWith('*') ? clean.startsWith(rule.slice(0, -1)) : clean === rule));
}
