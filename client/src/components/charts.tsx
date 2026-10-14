'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { isEverydayLeave, leaveColor, OTHER_LEAVE_COLOR } from '@/lib/leave-colors';

/**
 * Charts follow the dataviz method: status series in a fixed order with
 * validated light/dark steps (see globals.css), thin marks, recessive grid,
 * a legend plus hover tooltips so identity never rests on colour alone.
 */

export const SERIES = [
  { key: 'present', label: 'Present', color: 'var(--chart-present)' },
  { key: 'late', label: 'Late', color: 'var(--chart-late)' },
  { key: 'absent', label: 'Absent', color: 'var(--chart-absent)' },
  { key: 'onLeave', label: 'On leave', color: 'var(--chart-leave)' },
] as const;

type Row = { date: string; present: number; late: number; absent: number; onLeave: number };

const axis = { stroke: 'var(--muted-foreground)', fontSize: 12, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, title }: TooltipProps<number, string> & { title?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2.5 text-sm shadow-float">
      <p className="mb-1.5 font-semibold">{title ? title(String(label)) : label}</p>
      <ul className="grid gap-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="h-[3px] w-3 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="tabular ml-auto font-medium">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeriesLegend({ className }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground ${className ?? ''}`}>
      {SERIES.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-3.5 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

const dayLabel = (d: string) => format(parseISO(d), 'd MMM');
const dayTitle = (d: string) => format(parseISO(d), 'EEEE, d MMM');

/** 30-day company trend. Non-working days (all zero) are dropped rather than drawn as false dips. */
export function TrendLineChart({ data }: { data: Row[] }) {
  const rows = data.filter((r) => r.present + r.late + r.absent + r.onLeave > 0);
  return (
    <ResponsiveContainer width="99%" height={260} debounce={50}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="date" tickFormatter={dayLabel} {...axis} minTickGap={24} />
        <YAxis allowDecimals={false} {...axis} width={44} />
        <Tooltip content={<ChartTooltip title={dayTitle} />} cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Daily stacked bars for a team (14 days). Segments are separated by a 2px surface gap. */
export function TeamStackedBars({ data }: { data: Row[] }) {
  const rows = data.filter((r) => r.present + r.late + r.absent + r.onLeave > 0);
  return (
    <ResponsiveContainer width="99%" height={220} debounce={50}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="date" tickFormatter={dayLabel} {...axis} minTickGap={16} />
        <YAxis allowDecimals={false} {...axis} width={40} />
        <Tooltip content={<ChartTooltip title={dayTitle} />} cursor={{ fill: 'var(--accent)', opacity: 0.6 }} />
        {SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="a"
            fill={s.color}
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** "Not in yet" is not absence: it gets a quiet neutral segment of its own. */
const DEPT_SERIES = [...SERIES, { key: 'notIn', label: 'Not in yet', color: 'var(--off)' }] as const;

export function DepartmentLegend({ className }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground ${className ?? ''}`}>
      {DEPT_SERIES.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-3.5 rounded-full" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Today by department: horizontal stacked bars, one row per department. */
export function DepartmentBars({
  data,
}: {
  data: { name: string; present: number; late: number; absent: number; onLeave: number; notIn: number }[];
}) {
  return (
    <ResponsiveContainer width="99%" height={Math.max(160, data.length * 40 + 24)} debounce={50}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="name" {...axis} width={128} tick={{ fill: 'var(--foreground)', fontSize: 13 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--accent)', opacity: 0.6 }} />
        {DEPT_SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="d"
            fill={s.color}
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === DEPT_SERIES.length - 1 ? [0, 4, 4, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}


/** Leave days by type this year: a donut with a direct-labelled legend beside it. */
export function LeaveDonut({ data: raw }: { data: { code: string; name: string; days: number }[] }) {
  // Colour follows the entity (lib/leave-colors.ts), the same as on every other page.
  // Everyday types keep their own hue; every other type joins one slate "Other" slice.
  const everyday = raw.filter((d) => isEverydayLeave(d.code)).sort((a, b) => b.days - a.days);
  const rest = raw.filter((d) => !isEverydayLeave(d.code)).reduce((s, d) => s + d.days, 0);
  const data = rest > 0 ? [...everyday, { code: 'OTHER', name: 'Other', days: rest }] : everyday;
  const colorOf = (code: string) => (code === 'OTHER' ? OTHER_LEAVE_COLOR : leaveColor(code));
  const total = data.reduce((s, d) => s + d.days, 0);
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="relative mx-auto size-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="days" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={1.5} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.code} fill={colorOf(d.code)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="tabular text-figure-sm font-semibold">{total}</span>
          <span className="text-xs text-muted-foreground">days taken</span>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {data.map((d) => (
          <li key={d.code} className="flex items-center gap-2.5 text-sm">
            <span className="h-[3px] w-3.5 rounded-full" style={{ background: colorOf(d.code) }} aria-hidden />
            <span className="truncate">{d.name}</span>
            <span className="tabular ml-auto font-medium">{d.days}</span>
            <span className="tabular w-10 text-right text-xs text-muted-foreground">{total ? Math.round((d.days / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
