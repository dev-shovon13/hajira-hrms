'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { AttendanceStatus } from '@hajira/shared';
import { fmtTime } from '@/lib/format';
import { ATTENDANCE_TONE, TONES } from '@/lib/status';

const PAD = 3 * 60 * 60_000; // three hours either side of the shift

/**
 * The shift seam: the day as a dashed track, the scheduled shift stitched in,
 * the grace period bracketed, a needle at "now", and the worked thread pulled
 * through from check-in to check-out (or to now while the day is open).
 */
export function ShiftSeam({
  window,
  checkIn,
  checkOut,
  status,
  now,
  tz,
}: {
  window: { start: string; graceEnd: string; end: string };
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus | null;
  now: Date;
  tz: string;
}) {
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  const grace = new Date(window.graceEnd).getTime();
  const from = Math.min(start - PAD, checkIn ? new Date(checkIn).getTime() - 30 * 60_000 : Infinity);
  const to = Math.max(end + PAD, checkOut ? new Date(checkOut).getTime() + 30 * 60_000 : 0);
  const span = to - from;
  const pct = (t: number) => `${(Math.min(Math.max(t, from), to) - from) / span * 100}%`;
  const width = (a: number, b: number) => `${(Math.max(0, Math.min(b, to) - Math.max(a, from)) / span) * 100}%`;

  const workedFrom = checkIn ? new Date(checkIn).getTime() : null;
  const workedTo = checkOut ? new Date(checkOut).getTime() : now.getTime();
  const tone = status ? ATTENDANCE_TONE[status] : 'present';
  const thread = TONES[tone].mark;
  const nowInRange = now.getTime() >= from && now.getTime() <= to;

  const label = [
    `Shift ${fmtTime(window.start, tz)} to ${fmtTime(window.end, tz)}, grace until ${fmtTime(window.graceEnd, tz)}.`,
    checkIn ? `Checked in ${fmtTime(checkIn, tz)}.` : 'Not checked in.',
    checkOut ? `Checked out ${fmtTime(checkOut, tz)}.` : '',
  ].join(' ');

  return (
    <div className="relative h-14 select-none" role="img" aria-label={label}>
      {/* the day */}
      <div className="stitch-line absolute inset-x-0 top-5 h-px [--gap:5px] [--stitch:5px] [--thread:var(--off)]" />
      {/* scheduled shift: dashed indigo thread */}
      <div
        className="stitch-line absolute top-[19px] h-[3px] rounded-full opacity-70 [--gap:5px] [--stitch:9px] [--thread:var(--ring)]"
        style={{ left: pct(start), width: width(start, end) }}
      />
      {/* grace bracket */}
      <div
        className="absolute top-[13px] h-[15px] border-x border-late bg-late/15"
        style={{ left: pct(start), width: width(start, grace) }}
        aria-hidden
      />
      {/* worked thread, pulled through on check-in */}
      {workedFrom !== null && (
        <motion.div
          key={checkIn}
          className="absolute top-[18px] h-[5px] origin-left rounded-full"
          style={{ left: pct(workedFrom), width: width(workedFrom, workedTo), background: thread }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {/* now needle */}
      {nowInRange && !checkOut && (
        <div className="absolute top-2 h-7 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: pct(now.getTime()) }} aria-hidden>
          <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-marigold ring-2 ring-card" />
        </div>
      )}
      {/* ticks */}
      {[
        { t: from, label: fmtTime(new Date(from).toISOString(), tz), align: 'left' as const },
        { t: start, label: fmtTime(window.start, tz) },
        { t: end, label: fmtTime(window.end, tz) },
        { t: to, label: fmtTime(new Date(to).toISOString(), tz), align: 'right' as const },
      ].map((tick, i) => (
        <span
          key={i}
          className="tabular absolute top-9 text-xs text-muted-foreground"
          style={
            tick.align === 'left'
              ? { left: 0 }
              : tick.align === 'right'
                ? { right: 0 }
                : { left: pct(tick.t), transform: 'translateX(-50%)' }
          }
          aria-hidden
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}
