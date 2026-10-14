import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLES = {
  error: { icon: AlertCircle, cls: 'bg-absent-wash text-absent-ink' },
  success: { icon: CheckCircle2, cls: 'bg-present-wash text-present-ink' },
  info: { icon: Info, cls: 'bg-leave-wash text-leave-ink' },
  warning: { icon: AlertCircle, cls: 'bg-late-wash text-late-ink' },
};

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof STYLES;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = STYLES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg p-3.5 text-sm', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed [&_a]:font-medium [&_a]:underline [&_button]:font-medium [&_button]:underline">{children}</div>}
      </div>
    </div>
  );
}
