import { cn } from '@/lib/utils';

/** The mark: three stitches in marigold between two in white. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--rail-raised)" />
      <g stroke="var(--marigold)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M7 16h4M14 16h4M21 16h4" />
      </g>
      <g stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".9">
        <path d="M7 10.5h4M21 21.5h4" />
      </g>
    </svg>
  );
}

export function Logo({ tone = 'dark', collapsed = false }: { tone?: 'light' | 'dark'; collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className={cn('text-xl font-bold tracking-[-0.01em]', tone === 'light' ? 'text-white' : 'text-foreground')}>
          Hajira
        </span>
      )}
    </span>
  );
}
