import * as React from 'react';
import type { AttendanceStatus, LeaveStatus, RequestStatus } from '@hajira/shared';
import { ATTENDANCE_STATUS_LABELS } from '@hajira/shared';
import { ATTENDANCE_TONE, REQUEST_LABEL, REQUEST_TONE, TONES, type Tone } from '@/lib/status';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="grid gap-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.015em] sm:text-[2rem]">{title}</h1>
        {description && <p className="max-w-[65ch] text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A status pill: a thread swatch (form) plus a label (words), never colour alone. */
export function Badge({ tone, children, dashed, className }: { tone: Tone; children: React.ReactNode; dashed?: boolean; className?: string }) {
  const t = TONES[tone];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold', t.wash, t.ink, className)}>
      <span
        aria-hidden
        className="h-[3px] w-2.5 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${t.mark} 0 3px, transparent 3px 5px)` }
            : { background: t.mark }
        }
      />
      {children}
    </span>
  );
}

export function AttendanceBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  return (
    <Badge tone={ATTENDANCE_TONE[status]} className={className}>
      {ATTENDANCE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function RequestBadge({ status, className }: { status: LeaveStatus | RequestStatus; className?: string }) {
  return (
    <Badge tone={REQUEST_TONE[status]} dashed={status === 'PENDING'} className={className}>
      {REQUEST_LABEL[status]}
    </Badge>
  );
}

/** Needle and thread: the empty-state illustration, tinted per context. */
export function NeedleIllustration({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  const thread = tone === 'neutral' ? 'var(--muted-foreground)' : TONES[tone].mark;
  return (
    <svg viewBox="0 0 160 72" className={cn('h-16 w-36', className)} aria-hidden>
      <g stroke="var(--off)" strokeWidth="3" strokeLinecap="round">
        <path d="M8 52h12M28 52h12M48 52h12" />
      </g>
      <path
        d="M64 52c10 0 14-6 22-14s18-18 30-18 18 8 16 16"
        fill="none"
        stroke={thread}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 5"
      />
      <g transform="rotate(-38 132 30)">
        <rect x="104" y="27" width="54" height="5" rx="2.5" fill="var(--foreground)" opacity=".85" />
        <rect x="146" y="28.4" width="8" height="2.2" rx="1.1" fill="var(--card)" />
        <path d="M104 27l-8 2.5 8 2.5z" fill="var(--foreground)" opacity=".85" />
      </g>
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  tone,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('grid justify-items-center gap-3 px-6 py-12 text-center', className)}>
      <NeedleIllustration tone={tone} />
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid justify-items-center gap-3 px-6 py-12 text-center" role="alert">
      <NeedleIllustration tone="absent" />
      <div className="grid gap-1">
        <p className="font-semibold">This did not load</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm font-medium text-leave-ink underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}

/** Label + value pair for detail panels. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-1', className)}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  );
}
