import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/** Office timezone; the API reports it with /attendance/today and /settings. */
export const DEFAULT_TZ = 'Asia/Dhaka';

export const fmtTime = (iso: string | null | undefined, tz = DEFAULT_TZ) =>
  iso ? formatInTimeZone(iso, tz, 'HH:mm') : '—';

export const fmtClock = (date: Date, tz = DEFAULT_TZ) => formatInTimeZone(date, tz, 'HH:mm:ss');

/** "Wed 14 Oct" for YYYY-MM-DD calendar dates. */
export const fmtDay = (date: string) => format(parseISO(date), 'EEE d MMM');
export const fmtDate = (date: string) => format(parseISO(date), 'd MMM yyyy');
export const fmtDateLong = (date: string) => format(parseISO(date), 'EEEE, d MMMM yyyy');

export function fmtRange(start: string, end: string) {
  if (start === end) return fmtDate(start);
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getFullYear() === e.getFullYear()) {
    return s.getMonth() === e.getMonth()
      ? `${format(s, 'd')}–${format(e, 'd MMM yyyy')}`
      : `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** 551 → "9h 11m"; 45 → "45m". */
export function fmtMinutes(min: number) {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export const fmtAgo = (iso: string) => `${formatDistanceToNowStrict(parseISO(iso))} ago`;

export const fmtDays = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? '' : 's'}`;

/** Local "YYYY-MM-DD" in the office timezone. */
export const todayIn = (tz = DEFAULT_TZ) => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');

export function greeting(tz = DEFAULT_TZ) {
  const h = Number(formatInTimeZone(new Date(), tz, 'H'));
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
