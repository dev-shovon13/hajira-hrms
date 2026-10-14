'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePenLine } from 'lucide-react';
import { toast } from 'sonner';
import type { MonthDay, MonthSummary, RegularizationDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { AttendanceBadge, Badge, EmptyState, ErrorState, Field, PageHeader, RequestBadge } from '@/components/common';
import { ConfirmDialog } from '@/components/ui/dialog';
import { StitchLegend, StitchRow } from '@/components/stitch/stitch-row';
import { MonthNav } from '@/components/month-nav';
import { errorMessage, get, getPage, send } from '@/lib/api';
import { DEFAULT_TZ, fmtDateLong, fmtDay, fmtMinutes, fmtTime, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RegularizeDialog } from './regularize-dialog';

export function MyAttendance({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const params = useSearchParams();
  const tz = DEFAULT_TZ;
  const today = todayIn(tz);
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [selected, setSelected] = React.useState<MonthDay | null>(null);
  const [regularizeOpen, setRegularizeOpen] = React.useState(params.get('regularize') === '1');

  const q = useQuery({
    queryKey: ['attendance', 'month', userId ?? 'me', month],
    queryFn: () => get<MonthSummary>('/attendance/month', { params: { month, userId } }),
    placeholderData: (prev) => prev,
  });

  React.useEffect(() => setSelected(null), [month]);

  const days = q.data?.days ?? [];
  const recorded = [...days].filter((d) => !d.isFuture && d.status && d.status !== 'WEEKEND').reverse();
  const t = q.data?.totals;

  return (
    <>
      {!readOnly && (
        <PageHeader
          title="My attendance"
          description="Every day of the month as a stitch. Pick a day to see its times, or ask for a correction if something is wrong."
          actions={
            <Button variant="outline" onClick={() => setRegularizeOpen(true)}>
              <FilePenLine /> Request correction
            </Button>
          }
        />
      )}

      <div className="grid gap-5 lg:gap-6">
        <Card>
          <CardHeader className="flex-col sm:flex-row sm:items-center">
            <CardTitle>Month at a glance</CardTitle>
            <MonthNav month={month} onChange={setMonth} max={today.slice(0, 7)} />
          </CardHeader>
          <CardContent className="grid gap-6">
            {q.isLoading ? (
              <Skeleton className="h-28" />
            ) : q.error ? (
              <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
            ) : (
              <>
                <div className={cn('transition-opacity', q.isFetching && 'opacity-60')}>
                  <StitchRow days={days} tz={tz} onSelect={setSelected} selected={selected?.date} />
                </div>
                {t && (
                  <StitchLegend
                    className="border-t pt-5 sm:grid-cols-3 lg:grid-cols-6"
                    items={[
                      { label: 'Present', value: t.PRESENT, tone: 'present' },
                      { label: 'Late', value: t.LATE, tone: 'late' },
                      { label: 'Half day', value: t.HALF_DAY, tone: 'halfday' },
                      { label: 'Absent', value: t.ABSENT, tone: 'absent' },
                      { label: 'On leave', value: t.ON_LEAVE, tone: 'leave' },
                      { label: 'Overtime', value: fmtMinutes(t.overtimeMinutes), tone: 'holiday' },
                    ]}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Day by day</CardTitle>
              {t && <span className="tabular text-sm text-muted-foreground">{fmtMinutes(t.workMinutes)} worked</span>}
            </CardHeader>
            <div className="mt-4 overflow-x-auto border-t">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Attendance records for the month</caption>
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground">
                    <th scope="col" className="h-10 px-5 font-medium">Date</th>
                    <th scope="col" className="px-3 font-medium">In</th>
                    <th scope="col" className="px-3 font-medium">Out</th>
                    <th scope="col" className="px-3 font-medium">Worked</th>
                    <th scope="col" className="px-5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recorded.map((d) => (
                    <tr
                      key={d.date}
                      onClick={() => setSelected(d)}
                      className={cn('cursor-pointer border-b last:border-0 hover:bg-accent/50', selected?.date === d.date && 'bg-accent')}
                    >
                      <td className="h-12 px-5 font-medium">{fmtDay(d.date)}</td>
                      <td className="tabular px-3">{fmtTime(d.checkIn, tz)}</td>
                      <td className="tabular px-3">{fmtTime(d.checkOut, tz)}</td>
                      <td className="tabular px-3">{d.workMinutes ? fmtMinutes(d.workMinutes) : '—'}</td>
                      <td className="px-5">
                        <span className="flex items-center gap-2">
                          {d.status && <AttendanceBadge status={d.status} />}
                          {d.lateMinutes > 0 && <span className="tabular text-[13px] text-late-ink">+{d.lateMinutes}m</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!q.isLoading && recorded.length === 0 && <EmptyState title="No days recorded this month" description="Check in from the dashboard and your days fill in here." />}
            </div>
          </Card>

          <div className="grid content-start gap-5 lg:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{selected ? fmtDateLong(selected.date) : 'Pick a day'}</CardTitle>
              </CardHeader>
              <CardContent>
                {selected ? (
                  <div className="grid gap-5">
                    <dl className="grid grid-cols-2 gap-4">
                      <Field label="Status">
                        {selected.status ? <AttendanceBadge status={selected.status} /> : <Badge tone="neutral" dashed>No record</Badge>}
                      </Field>
                      <Field label="Worked">
                        <span className="tabular">{selected.workMinutes ? fmtMinutes(selected.workMinutes) : '—'}</span>
                      </Field>
                      <Field label="Checked in">
                        <span className="tabular">{fmtTime(selected.checkIn, tz)}</span>
                      </Field>
                      <Field label="Checked out">
                        <span className="tabular">{fmtTime(selected.checkOut, tz)}</span>
                      </Field>
                      {selected.lateMinutes > 0 && (
                        <Field label="Late by">
                          <span className="tabular text-late-ink">{selected.lateMinutes} min</span>
                        </Field>
                      )}
                      {selected.label && <Field label="Note">{selected.label}</Field>}
                    </dl>
                    {!readOnly && !selected.isFuture && selected.status !== 'HOLIDAY' && selected.status !== 'WEEKEND' && (
                      <Button variant="outline" onClick={() => setRegularizeOpen(true)}>
                        <FilePenLine /> Correct this day
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a stitch above or a row in the table to see the day’s details.</p>
                )}
              </CardContent>
            </Card>
            {!readOnly && <MyCorrections tz={tz} />}
          </div>
        </div>
      </div>

      {!readOnly && (
        <RegularizeDialog open={regularizeOpen} onOpenChange={setRegularizeOpen} date={selected?.date} maxDate={today} />
      )}
    </>
  );
}

function MyCorrections({ tz }: { tz: string }) {
  const qc = useQueryClient();
  const [cancelling, setCancelling] = React.useState<RegularizationDto | null>(null);
  const q = useQuery({
    queryKey: ['regularizations', 'mine'],
    queryFn: () => getPage<RegularizationDto>('/regularizations', { scope: 'mine', limit: 6 }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => send('post', `/regularizations/${id}/cancel`),
    onSuccess: ({ message }) => {
      toast.success(message);
      setCancelling(null);
      void qc.invalidateQueries({ queryKey: ['regularizations'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>My corrections</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Skeleton className="h-24" />
        ) : !q.data?.rows.length ? (
          <p className="text-sm text-muted-foreground">No correction requests yet.</p>
        ) : (
          <ul className="divide-y">
            {q.data.rows.map((r) => (
              <li key={r.id} className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{fmtDay(r.date)}</span>
                  <RequestBadge status={r.status} />
                </div>
                <p className="tabular text-[13px] text-muted-foreground">
                  {r.requestedCheckIn && `In ${fmtTime(r.requestedCheckIn, tz)} `}
                  {r.requestedCheckOut && `Out ${fmtTime(r.requestedCheckOut, tz)}`}
                  {r.reviewComment && ` · “${r.reviewComment}”`}
                </p>
                {r.status === 'PENDING' && (
                  <button type="button" onClick={() => setCancelling(r)} className="w-fit text-[13px] font-medium text-absent-ink underline-offset-4 hover:underline">
                    Cancel request
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={Boolean(cancelling)}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this correction?"
        description={cancelling ? `Your request for ${fmtDay(cancelling.date)} will be withdrawn.` : ''}
        confirmLabel="Cancel request"
        loading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      />
    </Card>
  );
}
