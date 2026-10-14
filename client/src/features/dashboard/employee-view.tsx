'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import type { EmployeeDashboardDto } from '@hajira/shared';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/common';
import { StitchLegend, StitchRow } from '@/components/stitch/stitch-row';
import { QuotaStitch } from '@/components/stitch/quota-stitch';
import { get, errorMessage } from '@/lib/api';
import { fmtAgo, fmtDays } from '@/lib/format';
import { TONES } from '@/lib/status';
import { cn } from '@/lib/utils';
import { TodayCard } from './today-card';

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: () => get<EmployeeDashboardDto>('/dashboard/employee'),
    refetchInterval: 5 * 60_000,
  });
}

export function EmployeeView() {
  const q = useEmployeeDashboard();
  if (q.isLoading) return <EmployeeSkeleton />;
  if (q.error || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const { today, month, balances, activity, lateMarks } = q.data;
  const monthName = new Date(`${month.month}-01T00:00:00`).toLocaleString('en', { month: 'long' });

  return (
    <div className="grid gap-5 lg:gap-6">
      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <TodayCard today={today} />

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>{monthName} so far</CardTitle>
            <Link href="/attendance" className="text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
              Full month
            </Link>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              {month.totals.workingDays} working days · {Math.round(month.totals.workMinutes / 60)} hours logged
            </p>
            <StitchRow days={month.days} tz={today.timezone} size="lg" />
            <StitchLegend
              className="mt-auto border-t pt-5"
              items={[
                { label: 'Present', value: month.totals.PRESENT + month.totals.HALF_DAY, tone: 'present' },
                { label: 'Late', value: month.totals.LATE, tone: 'late' },
                { label: 'Absent', value: month.totals.ABSENT, tone: 'absent' },
                { label: 'On leave', value: month.totals.ON_LEAVE, tone: 'leave' },
              ]}
            />
            {lateMarks.threshold && lateMarks.count > 0 && (
              <p className={cn('rounded-lg px-3.5 py-2.5 text-sm', lateMarks.count >= lateMarks.threshold ? 'bg-absent-wash text-absent-ink' : 'bg-late-wash text-late-ink')}>
                {lateMarks.count} late mark{lateMarks.count === 1 ? '' : 's'} this month. Every {lateMarks.threshold} cost one day of casual leave.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Leave balance</CardTitle>
            <Button asChild size="sm">
              <Link href="/leave?apply=1">
                <Plus /> Apply for leave
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {balances
                .filter((b) => b.leaveType.isPaid && b.allocated + b.carriedForward + b.adjusted > 0)
                .map((b) => (
                  <li key={b.id} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-4 py-3.5 first:pt-1 last:pb-0">
                    <span className="truncate text-[15px]">{b.leaveType.name}</span>
                    <QuotaStitch balance={b} />
                    <span className="tabular text-right text-sm">
                      <strong className="text-base font-semibold">{b.available}</strong>
                      <span className="text-muted-foreground"> / {b.allocated + b.carriedForward + b.adjusted}</span>
                      {b.pending > 0 && <span className="block text-xs text-leave-ink">{fmtDays(b.pending)} pending</span>}
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <Link href="/attendance" className="inline-flex items-center gap-1 text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
              History <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState title="Nothing yet" description="Your check-ins and leave decisions will appear here." className="py-6" />
            ) : (
              <ul className="divide-y">
                {activity.map((a) => (
                  <li key={a.id} className="grid grid-cols-[0.875rem_minmax(0,1fr)_auto] items-start gap-3 py-3 first:pt-1 last:pb-0 sm:items-center">
                    <span className="mt-2 h-[3px] w-3.5 rounded-full sm:mt-0" style={{ background: TONES[a.tone].mark }} aria-hidden />
                    <span className="line-clamp-2 text-sm sm:line-clamp-1">{a.title}</span>
                    <time className="whitespace-nowrap text-[13px] text-muted-foreground" dateTime={a.at}>
                      {fmtAgo(a.at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function EmployeeSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
