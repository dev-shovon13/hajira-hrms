'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

const RULES = [
  { test: (v: string) => v.length >= 8, label: '8+ characters' },
  { test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v), label: 'Upper & lower case' },
  { test: (v: string) => /\d/.test(v), label: 'A number' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: 'A symbol' },
];

/** Strength as four stitches: each rule met pulls one stitch tight. */
export function PasswordStrength({ value }: { value: string }) {
  const met = RULES.map((r) => r.test(value));
  const count = met.filter(Boolean).length;
  const color = count <= 1 ? 'var(--absent)' : count <= 3 ? 'var(--late)' : 'var(--present)';
  return (
    <div className="grid gap-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {met.map((ok, i) => (
          <span
            key={i}
            className="h-[3px] rounded-full transition-[background-color,opacity] duration-300"
            style={{ background: i < count && value ? color : 'var(--off)', opacity: i < count && value ? 1 : 0.6 }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
        {RULES.map((r, i) => (
          <li key={r.label} className={cn('flex items-center gap-1.5', met[i] ? 'text-present-ink' : 'text-muted-foreground')}>
            <span className={cn('h-[2px] w-2.5 rounded-full', met[i] ? 'bg-present' : 'bg-off')} aria-hidden />
            {r.label}
            <span className="sr-only">{met[i] ? '(done)' : '(missing)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
