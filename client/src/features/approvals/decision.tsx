'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveApprovalDto, LeaveRequestDto, RegularizationDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Label, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RequestBadge } from '@/components/common';
import { errorMessage, send } from '@/lib/api';
import { fmtAgo, fmtDays, fmtRange, fmtTime, fmtDay } from '@/lib/format';
import { cn } from '@/lib/utils';

type Kind = 'leave' | 'regularization';

/** Approve / reject with optimistic removal from every approvals list. */
export function useDecision(kind: Kind) {
  const qc = useQueryClient();
  const base = kind === 'leave' ? '/leave/requests' : '/regularizations';
  const listKey = [kind === 'leave' ? 'leave' : 'regularizations', 'approvals'];

  const settle = () => {
    for (const k of [['leave'], ['regularizations'], ['dashboard'], ['counts'], ['attendance'], ['calendar']]) {
      void qc.invalidateQueries({ queryKey: k });
    }
  };
  const optimistic = async (id: string) => {
    await qc.cancelQueries({ queryKey: listKey });
    const snapshots = qc.getQueriesData<{ rows: { id: string }[] }>({ queryKey: listKey });
    qc.setQueriesData<{ rows: { id: string }[]; meta?: { total: number } }>({ queryKey: listKey }, (old) =>
      old ? { ...old, rows: old.rows.filter((r) => r.id !== id), meta: old.meta ? { ...old.meta, total: old.meta.total - 1 } : old.meta } : old,
    );
    return { snapshots };
  };
  const rollback = (ctx?: { snapshots: [readonly unknown[], unknown][] }) => {
    ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
  };

  const approve = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => send('post', `${base}/${id}/approve`, { comment }),
    onMutate: ({ id }) => optimistic(id),
    onError: (err, _v, ctx) => {
      rollback(ctx);
      toast.error(errorMessage(err));
    },
    onSuccess: ({ message }) => toast.success(message),
    onSettled: settle,
  });
  const reject = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => send('post', `${base}/${id}/reject`, { comment }),
    onMutate: ({ id }) => optimistic(id),
    onError: (err, _v, ctx) => {
      rollback(ctx);
      toast.error(errorMessage(err));
    },
    onSuccess: ({ message }) => toast.success(message),
    onSettled: settle,
  });
  return { approve, reject };
}

/** The approval chain as stitches: approved solid, waiting dashed, rejected struck, skipped hairline. */
export function ApprovalChain({ approvals }: { approvals: LeaveApprovalDto[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]" aria-label="Approval steps">
      {approvals.map((a) => {
        const style: React.CSSProperties =
          a.decision === 'APPROVED'
            ? { background: 'var(--present)', height: 3 }
            : a.decision === 'PENDING'
              ? { backgroundImage: 'repeating-linear-gradient(90deg, var(--leave) 0 4px, transparent 4px 7px)', height: 3 }
              : a.decision === 'REJECTED'
                ? { background: 'var(--absent)', height: 3 }
                : { background: 'var(--off)', height: 1 };
        const who = a.approverRole === 'MANAGER' ? 'Manager' : 'HR';
        const text =
          a.decision === 'APPROVED'
            ? `${who} approved${a.approver ? ` (${a.approver.name})` : ''}`
            : a.decision === 'PENDING'
              ? `Waiting on ${who === 'HR' ? 'HR' : 'manager'}`
              : a.decision === 'REJECTED'
                ? `${who} rejected`
                : `${who} skipped`;
        return (
          <li key={a.id} className="flex items-center gap-2">
            <span className="relative w-6 rounded-full" style={style} aria-hidden>
              {a.decision === 'REJECTED' && <span className="absolute -top-1 left-1/2 h-[11px] w-px -translate-x-1/2 rotate-45 bg-absent" />}
            </span>
            <span className={cn(a.decision === 'PENDING' ? 'text-leave-ink' : a.decision === 'REJECTED' ? 'text-absent-ink' : 'text-muted-foreground')}>
              {text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RejectDialog({
  open,
  onOpenChange,
  who,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  who: string;
  onConfirm: (comment: string) => void;
  loading: boolean;
}) {
  const [comment, setComment] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const invalid = comment.trim().length < 3;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Reject {who}&apos;s request?</DialogTitle>
          <DialogDescription>They will see your reason in the app and by email.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!invalid) onConfirm(comment.trim());
          }}
        >
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Release week: could you move this by a few days?"
            aria-invalid={touched && invalid}
            autoFocus
          />
          {touched && invalid && <p className="text-[13px] font-medium text-absent-ink">Give a short reason (3+ characters).</p>}
          <DialogFooter className="mt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={loading}>
              Reject request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DecisionButtons({ kind, id, who, compact }: { kind: Kind; id: string; who: string; compact?: boolean }) {
  const { approve, reject } = useDecision(kind);
  const [rejecting, setRejecting] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Button size={compact ? 'sm' : 'default'} variant="success" onClick={() => approve.mutate({ id })} loading={approve.isPending}>
        {!approve.isPending && <Check />} Approve
      </Button>
      <Button size={compact ? 'sm' : 'default'} variant="outline" onClick={() => setRejecting(true)}>
        <X /> Reject
      </Button>
      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        who={who}
        loading={reject.isPending}
        onConfirm={(comment) => reject.mutate({ id, comment }, { onSuccess: () => setRejecting(false) })}
      />
    </div>
  );
}

export function LeaveRequestItem({ r, compact = false, showActions = true }: { r: LeaveRequestDto; compact?: boolean; showActions?: boolean }) {
  return (
    <article className={cn('grid gap-3', compact ? 'py-4' : 'p-5')}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={r.user.name} src={r.user.avatarUrl} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="font-semibold leading-snug">
            {r.user.name}
            <span className="font-normal text-muted-foreground"> · {r.user.department?.name ?? '—'}</span>
          </p>
          <p className="text-sm">
            <span className="font-medium">{r.leaveType.name}</span> · {fmtRange(r.startDate, r.endDate)}
            {r.isHalfDay && ` (${r.halfDaySession === 'FIRST_HALF' ? 'morning' : 'afternoon'})`} ·{' '}
            <span className="tabular font-medium">{fmtDays(r.days)}</span>
          </p>
        </div>
        {!showActions || !r.canDecide ? <RequestBadge status={r.status} /> : <span className="text-[13px] text-muted-foreground">{fmtAgo(r.createdAt)}</span>}
      </div>
      <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">“{r.reason}”</p>
      {r.attachmentUrl && (
        <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
          <Paperclip className="size-4" aria-hidden /> Attachment
        </a>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ApprovalChain approvals={r.approvals} />
        {showActions && r.canDecide && <DecisionButtons kind="leave" id={r.id} who={r.user.name.split(' ')[0]} compact={compact} />}
      </div>
    </article>
  );
}

export function RegularizationItem({ r, tz, compact = false, showActions = true }: { r: RegularizationDto; tz: string; compact?: boolean; showActions?: boolean }) {
  const change = (label: string, before: string | null | undefined, after: string | null) =>
    after ? (
      <span className="tabular">
        {label}{' '}
        <span className="text-muted-foreground line-through decoration-absent/60">{before ? fmtTime(before, tz) : 'none'}</span>{' '}
        → <strong className="font-semibold">{fmtTime(after, tz)}</strong>
      </span>
    ) : null;
  return (
    <article className={cn('grid gap-3', compact ? 'py-4' : 'p-5')}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={r.user.name} src={r.user.avatarUrl} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="font-semibold leading-snug">
            {r.user.name}
            <span className="font-normal text-muted-foreground"> · correction for {fmtDay(r.date)}</span>
          </p>
          <p className="flex flex-wrap gap-x-4 text-sm">
            {change('In', r.original?.checkIn, r.requestedCheckIn)}
            {change('Out', r.original?.checkOut, r.requestedCheckOut)}
          </p>
        </div>
        {!showActions || !r.canDecide ? <RequestBadge status={r.status} /> : <span className="text-[13px] text-muted-foreground">{fmtAgo(r.createdAt)}</span>}
      </div>
      <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">“{r.reason}”</p>
      {r.reviewComment && <p className="text-sm">Reviewer: {r.reviewComment}</p>}
      {showActions && r.canDecide && (
        <div className="flex justify-end">
          <DecisionButtons kind="regularization" id={r.id} who={r.user.name.split(' ')[0]} compact={compact} />
        </div>
      )}
    </article>
  );
}
