import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Time model
 * - Instants (check-in, check-out, createdAt) are UTC Date objects.
 * - Calendar dates (attendance day, leave range, holidays) are office-local
 *   "YYYY-MM-DD" strings in code and @db.Date (UTC midnight) in Postgres.
 * - Shift times are minutes after local midnight.
 */

/** Office-local calendar date of an instant. */
export function localDate(instant: Date, tz: string) {
  return formatInTimeZone(instant, tz, 'yyyy-MM-dd');
}

/** Minutes after local midnight for an instant. */
export function localMinutes(instant: Date, tz: string) {
  const [h, m] = formatInTimeZone(instant, tz, 'HH:mm').split(':').map(Number);
  return h * 60 + m;
}

/** A @db.Date value for a YYYY-MM-DD string. */
export function dbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

/** YYYY-MM-DD for a @db.Date value. */
export function dateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysStr(date: string, days: number) {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

export function daysBetween(from: string, to: string) {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** Inclusive list of dates between two YYYY-MM-DD strings. */
export function eachDate(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string) {
  return dbDate(date).getUTCDay();
}

/** UTC instant of a local date + minutes after midnight (minutes may exceed 1440). */
export function zonedInstant(date: string, minutes: number, tz: string) {
  const dayOffset = Math.floor(minutes / 1440);
  const rem = ((minutes % 1440) + 1440) % 1440;
  const day = addDaysStr(date, dayOffset);
  const hh = String(Math.floor(rem / 60)).padStart(2, '0');
  const mm = String(rem % 60).padStart(2, '0');
  return fromZonedTime(`${day}T${hh}:${mm}:00`, tz);
}

export function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export const toHHmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const fromHHmm = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

export function monthRange(month: string) {
  const start = `${month}-01`;
  const next = format(addDays(parseISO(`${month}-28`), 4), 'yyyy-MM');
  const end = addDaysStr(`${next}-01`, -1);
  return { start, end };
}

export function currentMonth(tz: string, now = new Date()) {
  return formatInTimeZone(now, tz, 'yyyy-MM');
}

export function formatClock(instant: Date | null | undefined, tz: string) {
  return instant ? formatInTimeZone(instant, tz, 'HH:mm') : '—';
}

export function formatHuman(date: string) {
  return format(parseISO(date), 'EEE d MMM yyyy');
}
