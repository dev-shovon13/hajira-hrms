'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Paperclip, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveBalanceDto, LeaveRequestDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PageHeader, RequestBadge } from '@/components/common';
import { DataTable, useTableQuery } from '@/components/data-table';
import { QuotaStitch } from '@/components/stitch/quota-stitch';
import { ApprovalChain } from '@/features/approvals/decision';
import { errorMessage, get, getPage, send } from '@/lib/api';
import { fmtAgo, fmtDays, fmtRange } from '@/lib/format';
import { ApplyLeaveSheet } from './apply-leave';

export function MyLeave() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [applyOpen, setApplyOpen] = React.useState(params.get('apply') === '1');
  const [status, setStatus] = React.useState('all');
  const [cancelling, setCancelling] = React.useState<LeaveRequestDto | null>(null);
  const table = useTableQuery({ sort: 'createdAt' });
  const year = new Date().getFullYear();

  const balances = useQuery({ queryKey: ['leave', 'balances', 'me', year], queryFn: () => get<LeaveBalanceDto[]>('/leave/balances', { params: { year } }) });
  const requests = useQuery({
    queryKey: ['leave', 'requests', 'mine', table.params, status],
    queryFn: () => getPage<LeaveRequestDto>('/leave/requests', { ...table.params, scope: 'mine', status }),
    placeholderData: keepPreviousData,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => send('post', `/leave/requests/${id}/cancel`),
    onSuccess: ({ message }) => {
      toast.success(message);
      setCancelling(null);
      for (const k of [['leave'], ['dashboard'], ['counts']]) void qc.invalidateQueries({ queryKey: k });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns = React.useMemo<ColumnDef<LeaveRequestDto, unknown>[]>(
    () => [
      {
        id: 'startDate',
        header: 'Dates',
        enableSorting: true,
        cell: ({ row: { original: r } }) => (
          <div className="grid gap-0.5">
            <span className="font-medium">{fmtRange(r.startDate, r.endDate)}</span>
            <span className="text-[13px] text-muted-foreground">
              {r.leaveType.name}
              {r.isHalfDay && ` · ${r.halfDaySession === 'FIRST_HALF' ? 'morning' : 'afternoon'}`}
            </span>
          </div>
        ),
      },
      { id: 'days', header: 'Days', enableSorting: true, cell: ({ row }) => <span className="tabular">{fmtDays(row.original.days)}</span> },
      { id: 'status', header: 'Status', enableSorting: false, cell: ({ row }) => <RequestBadge status={row.original.status} /> },
      { id: 'chain', header: 'Approvals', enableSorting: false, cell: ({ row }) => <ApprovalChain approvals={row.original.approvals} /> },
      {
        id: 'createdAt',
        header: 'Applied',
        enableSorting: true,
        cell: ({ row: { original: r } }) => (
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {fmtAgo(r.createdAt)}
            {r.attachmentUrl && (
              <a href={r.attachmentUrl} target="_blank" rel="noreferrer" aria-label="Open attachment" className="text-leave-ink">
                <Paperclip className="size-4" />
              </a>
            )}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row: { original: r } }) =>
          r.status === 'PENDING' ? (
            <Button variant="ghost" size="sm" className="text-absent-ink hover:bg-absent-wash hover:text-absent-ink" onClick={() => setCancelling(r)}>
              Cancel
            </Button>
          ) : null,
      },
    ],
    [],
  );

  const shown = balances.data?.filter((b) => b.leaveType.isPaid && b.allocated + b.carriedForward + b.adjusted > 0) ?? [];
  const unpaid = balances.data?.find((b) => !b.leaveType.isPaid);

  return (
    <>
      <PageHeader
        title="Leave"
        description={`Your balances for ${year} and every request you have made. Days are counted only on your working days.`}
        actions={
          <Button onClick={() => setApplyOpen(true)}>
            <Plus /> Apply for leave
          </Button>
        }
      />

      <Card className="mb-6 p-5 sm:p-6">
        {balances.isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((b) => (
              <li key={b.id} className="grid gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{b.leaveType.name}</span>
                  <span className="tabular text-sm text-muted-foreground">
                    <strong className="text-figure-sm font-semibold text-foreground">{b.available}</strong> / {b.allocated + b.carriedForward + b.adjusted}
                  </span>
                </div>
                <QuotaStitch balance={b} />
                <p className="text-[13px] text-muted-foreground">
                  {fmtDays(b.used)} used
                  {b.pending > 0 && ` · ${fmtDays(b.pending)} pending`}
                  {b.carriedForward > 0 && ` · ${b.carriedForward} carried over`}
                  {b.adjusted < 0 && ` · ${-b.adjusted} deducted for lateness`}
                </p>
              </li>
            ))}
            {unpaid && (
              <li className="grid content-start gap-2.5">
                <span className="font-medium">{unpaid.leaveType.name}</span>
                <QuotaStitch balance={unpaid} />
              </li>
            )}
          </ul>
        )}
      </Card>

      <DataTable
        caption="My leave requests"
        columns={columns}
        data={requests.data?.rows}
        meta={requests.data?.meta}
        query={table}
        loading={requests.isLoading}
        error={requests.error ? errorMessage(requests.error) : null}
        onRetry={() => requests.refetch()}
        filters={
          <Select value={status} onValueChange={(v) => { setStatus(v); table.reset(); }}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        }
        empty={{
          title: 'No leave requests yet',
          description: 'When you apply, the request and its approval steps show up here.',
          action: (
            <Button onClick={() => setApplyOpen(true)}>
              <Plus /> Apply for leave
            </Button>
          ),
        }}
      />

      <ApplyLeaveSheet
        open={applyOpen}
        onOpenChange={(o) => {
          setApplyOpen(o);
          if (!o && params.get('apply')) router.replace('/leave');
        }}
        balances={balances.data}
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this leave request?"
        description={cancelling ? `${cancelling.leaveType.name}, ${fmtRange(cancelling.startDate, cancelling.endDate)}. Your approvers will no longer see it.` : ''}
        confirmLabel="Cancel request"
        loading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      />
    </>
  );
}
