'use client';

import * as React from 'react';
import { parseISO, format } from 'date-fns';
import type { MonthDay } from '@hajira/shared';
import { ATTENDANCE_STATUS_LABELS } from '@hajira/shared';
import { Tooltip } from '@/components/ui/primitives';
import { ATTENDANCE_TONE, TONES } from '@/lib/status';
import { fmtMinutes, fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The month as a running stitch: one stitch per day in its status thread.
 * Solid = settled, dashed = pending (today before check-out, leave awaiting
 * approval), hairline = weekly off. Reflows by whole cells: 16 per row on
 * phones, the full month on wider screens.
 */
export function StitchRow({
  days,
  tz,
  onSelect,
  selected,
  size = 'md',
}: {
  days: MonthDay[];
  tz: string;
  onSelect?: (day: MonthDay) => void;
  selected?: string | null;
  /** lg: the month is the figure of its card (heavier thread, weekday initials). */
  size?: 'md' | 'lg';
}) {
  return (
    <ol
      className={cn(
        'grid grid-cols-[repeat(16,minmax(0,1fr))] gap-x-1 gap-y-4',
        // md runs the whole month on one line; lg stacks it as two seams so every date has room.
        size === 'md' && 'sm:grid-cols-[repeat(31,minmax(0,1fr))]',
        size === 'lg' && 'gap-x-1.5 gap-y-6',
      )}
      aria-label="Days of the month"
    >
      {days.map((d) => (
        <li key={d.date} className="min-w-0">
          <DayStitch day={d} tz={tz} onSelect={onSelect} selected={selected === d.date} size={size} />
        </li>
      ))}
    </ol>
  );
}

function describe(d: MonthDay, tz: string) {
  const date = format(parseISO(d.date), 'EEE d MMM');
  if (d.isFuture && !d.status) return `${date}: upcoming`;
  if (!d.status) return `${date}: ${d.isToday ? 'not checked in yet' : 'no record'}`;
  const parts = [`${date}: ${ATTENDANCE_STATUS_LABELS[d.status]}${d.pending ? ' (pending)' : ''}`];
  if (d.label) parts.push(d.label);
  if (d.checkIn) parts.push(`in ${fmtTime(d.checkIn, tz)}${d.checkOut ? `, out ${fmtTime(d.checkOut, tz)}` : ''}`);
  if (d.workMinutes) parts.push(fmtMinutes(d.workMinutes));
  if (d.lateMinutes) parts.push(`${d.lateMinutes} min late`);
  return parts.join(' · ');
}

function DayStitch({
  day,
  tz,
  onSelect,
  selected,
  size,
}: {
  day: MonthDay;
  tz: string;
  onSelect?: (day: MonthDay) => void;
  selected: boolean;
  size: 'md' | 'lg';
}) {
  const w = size === 'lg' ? 6 : 3;
  const hair = size === 'lg' ? 2 : 1;
  const tone = day.status ? ATTENDANCE_TONE[day.status] : 'neutral';
  const color = TONES[tone].mark;
  const off = day.status === 'WEEKEND';
  const blank = !day.status;
  const label = describe(day, tz);

  const thread: React.CSSProperties = off
    ? { height: hair, background: 'var(--off)' }
    : blank
      ? { height: hair, backgroundImage: 'repeating-linear-gradient(90deg, var(--off) 0 3px, transparent 3px 6px)' }
      : day.pending
        ? { height: w, backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` }
        : { height: w, background: color };

  const content = (
    <>
      {size === 'lg' && (
        <span className={cn('text-[10px] leading-none', day.isToday ? 'font-bold text-foreground' : 'text-muted-foreground/70')} aria-hidden>
          {format(parseISO(day.date), 'EEEEE')}
        </span>
      )}
      <span className={cn('flex w-full items-center', size === 'lg' ? 'h-1.5' : 'h-[3px]')}>
        <span
          key={`${day.status}-${day.pending}`}
          className={cn('block w-full rounded-full', day.isToday && !day.pending && 'animate-stitch-in')}
          style={thread}
        />
      </span>
      <span
        className={cn(
          'tabular leading-none', size === 'lg' ? 'text-xs' : 'text-[11px]',
          day.isToday ? 'font-bold text-foreground' : off || day.isFuture ? 'text-muted-foreground/70' : 'text-muted-foreground',
        )}
      >
        {Number(day.date.slice(8))}
      </span>
      {day.isToday && <span className="absolute -bottom-2 left-1/2 size-1 -translate-x-1/2 rounded-full bg-marigold" aria-hidden />}
    </>
  );

  const cls = cn(
    'relative flex w-full flex-col items-center gap-2 rounded-md py-1.5 outline-none transition-colors',
    onSelect && 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
    selected && 'bg-accent',
  );

  return (
    <Tooltip content={label}>
      {onSelect ? (
        <button type="button" className={cls} onClick={() => onSelect(day)} aria-label={label} aria-pressed={selected}>
          {content}
        </button>
      ) : (
        <span className={cls} role="img" aria-label={label} tabIndex={0}>
          {content}
        </span>
      )}
    </Tooltip>
  );
}

/** Counts under the row, each with its thread swatch. */
export function StitchLegend({
  items,
  className,
}: {
  items: { label: string; value: number | string; tone: keyof typeof TONES }[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4', className)}>
      {items.map((i) => (
        <div key={i.label} className="grid gap-1">
          <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="h-[3px] w-3.5 rounded-full" style={{ background: TONES[i.tone].mark }} aria-hidden />
            {i.label}
          </dt>
          <dd className="tabular text-figure-sm font-semibold">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
