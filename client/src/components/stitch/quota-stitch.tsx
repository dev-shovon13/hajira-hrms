import type { LeaveBalanceDto } from '@hajira/shared';
import { cn } from '@/lib/utils';
import { leaveColor } from '@/lib/leave-colors';

const MAX_STITCHES = 30;

/**
 * A leave quota as stitches, one per day: available days in the type's thread,
 * pending days dashed, used days as a hairline. Large quotas (maternity) group
 * several days per stitch so the row never overflows.
 */
export function QuotaStitch({ balance, className }: { balance: LeaveBalanceDto; className?: string }) {
  const total = Math.max(0, balance.allocated + balance.carriedForward + balance.adjusted);
  const color = leaveColor(balance.leaveType.code, balance.leaveType.color);
  if (!balance.leaveType.isPaid || total === 0) {
    return (
      <p className={cn('text-[13px] text-muted-foreground', className)}>
        {balance.leaveType.isPaid ? 'No quota this year' : `Unpaid · ${balance.used} day${balance.used === 1 ? '' : 's'} taken`}
      </p>
    );
  }
  const perStitch = total > MAX_STITCHES ? Math.ceil(total / MAX_STITCHES) : 1;
  const count = Math.ceil(total / perStitch);
  const available = Math.max(0, balance.available) / perStitch;
  const pending = balance.pending / perStitch;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex h-[3px] items-center gap-[3px]" aria-hidden>
        {Array.from({ length: count }, (_, i) => {
          const state = i < Math.floor(available) ? 'free' : i < Math.ceil(available + pending) ? 'pending' : 'used';
          return (
            <span
              key={i}
              className="min-w-0 flex-1 rounded-full"
              style={
                state === 'free'
                  ? { height: 3, background: color }
                  : state === 'pending'
                    ? { height: 3, backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` }
                    : { height: 1, background: 'var(--off)' }
              }
            />
          );
        })}
      </div>
      {perStitch > 1 && <p className="text-xs text-muted-foreground">Each stitch is {perStitch} days</p>}
    </div>
  );
}
