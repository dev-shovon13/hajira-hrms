'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminDashboardDto, ManagerDashboardDto, TeamMemberToday } from '@hajira/shared';
import { Card, CardContent, CardHeader, CardTitle, Avatar, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { AttendanceBadge, Badge, EmptyState, ErrorState } from '@/components/common';
import { DepartmentLegend, SeriesLegend } from '@/components/charts';
import { LeaveRequestItem, RegularizationItem } from '@/features/approvals/decision';
import { errorMessage, get, send } from '@/lib/api';
import { DEFAULT_TZ, fmtDate, fmtTime } from '@/lib/format';
import { TONES } from '@/lib/status';
import { cn, plural } from '@/lib/utils';

const chartFallback = () => <Skeleton className="h-[220px] w-full" />;
const TrendLineChart = dynamic(() => import('@/components/charts').then((m) => m.TrendLineChart), { ssr: false, loading: chartFallback });
const TeamStackedBars = dynamic(() => import('@/components/charts').then((m) => m.TeamStackedBars), { ssr: false, loading: chartFallback });
const DepartmentBars = dynamic(() => import('@/components/charts').then((m) => m.DepartmentBars), { ssr: false, loading: chartFallback });
const LeaveDonut = dynamic(() => import('@/components/charts').then((m) => m.LeaveDonut), { ssr: false, loading: chartFallback });

/**
 * Today across a group as one stitched bar: each segment's length is its share,
 * with the count and label spelled out beneath so the colour never works alone.
 */
function TodayBar({ counts }: { counts: { present: number; late: number; absent: number; onLeave: number; notIn: number } }) {
  const parts = [
    { key: 'present', label: 'Present', n: counts.present, tone: 'present' as const },
    { key: 'late', label: 'Late', n: counts.late, tone: 'late' as const },
    { key: 'absent', label: 'Absent', n: counts.absent, tone: 'absent' as const },
    { key: 'onLeave', label: 'On leave', n: counts.onLeave, tone: 'leave' as const },
    { key: 'notIn', label: 'Not in yet', n: counts.notIn, tone: 'neutral' as const },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0) || 1;
  return (
    <div className="grid gap-5">
      <div className="flex h-2 gap-[3px]" aria-hidden>
        {parts
          .filter((p) => p.n > 0)
          .map((p) => (
            <span
              key={p.key}
              className="h-full rounded-full"
              style={{
                width: `${(p.n / total) * 100}%`,
                ...(p.key === 'notIn'
                  ? { backgroundImage: 'repeating-linear-gradient(90deg, var(--off) 0 6px, transparent 6px 10px)' }
                  : { background: TONES[p.tone].mark }),
              }}
            />
          ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        {parts.map((p) => (
          <div key={p.key} className="grid gap-1">
            <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="h-[3px] w-3.5 rounded-full" style={{ background: TONES[p.tone].mark }} aria-hidden />
              {p.label}
            </dt>
            <dd className="tabular text-figure-sm font-semibold">{p.n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MemberRow({ m, tz }: { m: TeamMemberToday; tz: string }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar name={m.name} src={m.avatarUrl} size="sm" />
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-sm font-medium">{m.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">{m.designation}</span>
      </span>
      {m.checkIn && <span className="tabular text-[13px] text-muted-foreground">{fmtTime(m.checkIn, tz)}</span>}
      {m.status && m.status !== 'NOT_IN' ? (
        <AttendanceBadge status={m.status} />
      ) : (
        <Badge tone="neutral" dashed>
          Not in yet
        </Badge>
      )}
    </li>
  );
}

export function ManagerView() {
  const q = useQuery({ queryKey: ['dashboard', 'manager'], queryFn: () => get<ManagerDashboardDto>('/dashboard/manager'), refetchInterval: 120_000 });
  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (q.error || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  const tz = DEFAULT_TZ;
  const pendingCount = d.pending.leave.length + d.pending.regularization.length;

  if (d.team.total === 0) {
    return (
      <Card>
        <EmptyState title="No one reports to you yet" description="When HR assigns people to you, their day and their requests show up here." />
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Your team today</CardTitle>
          <span className="text-sm text-muted-foreground">{plural(d.team.total, 'person', 'people')}</span>
        </CardHeader>
        <CardContent>
          <TodayBar counts={d.team} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Waiting for you</CardTitle>
            <Link href="/approvals" className="inline-flex items-center gap-1 text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
              All approvals <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="pt-1">
            {pendingCount === 0 ? (
              <EmptyState tone="present" title="Nothing waiting" description="New leave and correction requests from your team land here." className="py-8" />
            ) : (
              <div className="divide-y">
                {d.pending.leave.map((r) => (
                  <LeaveRequestItem key={r.id} r={r} compact />
                ))}
                {d.pending.regularization.map((r) => (
                  <RegularizationItem key={r.id} r={r} tz={tz} compact />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Who is in</CardTitle>
            <Link href="/team" className="text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
              Team attendance
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {d.members.map((m) => (
                <MemberRow key={m.id} m={m} tz={tz} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last two weeks</CardTitle>
          <SeriesLegend />
        </CardHeader>
        <CardContent>
          <TeamStackedBars data={d.trend} />
        </CardContent>
      </Card>
    </div>
  );
}

function PendingAccounts({ users }: { users: AdminDashboardDto['pendingAccounts'] }) {
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (id: string) => send('post', `/users/${id}/approve`, { role: 'EMPLOYEE' }),
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['counts'] });
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  if (users.length === 0) return <EmptyState tone="present" title="No accounts waiting" description="New registrations appear here for approval." className="py-6" />;
  return (
    <ul className="divide-y">
      {users.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{u.name}</span>
            <span className="truncate text-[13px] text-muted-foreground">
              {u.designation?.title} · {u.department?.name} {!u.emailVerified && '· email not confirmed'}
            </span>
          </span>
          <Button size="sm" variant="success" onClick={() => approve.mutate(u.id)} loading={approve.isPending && approve.variables === u.id}>
            <Check /> Approve
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/employees/pending`}>Review</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function AdminView() {
  const q = useQuery({ queryKey: ['dashboard', 'admin'], queryFn: () => get<AdminDashboardDto>('/dashboard/admin'), refetchInterval: 120_000 });
  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (q.error || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;

  const queue = [
    { label: 'Leave requests', n: d.pendingCounts.leave, href: '/approvals' },
    { label: 'Corrections', n: d.pendingCounts.regularization, href: '/approvals?tab=regularization' },
    { label: 'New accounts', n: d.pendingCounts.accounts, href: '/employees/pending' },
    { label: 'Flagged days', n: d.pendingCounts.flagged, href: '/team?flagged=true' },
  ];

  return (
    <div className="grid gap-5 lg:gap-6">
      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="grid gap-1">
              <CardTitle>Company today</CardTitle>
              <p className="text-sm text-muted-foreground">
                <span className="tabular font-semibold text-foreground">{d.today.rate}%</span> of expected people are in ·{' '}
                {plural(d.headcount, 'active employee')}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <TodayBar counts={d.today} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="divide-y">
              {queue.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="group flex items-center gap-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex-1 text-sm">{item.label}</span>
                    <span className={cn('tabular text-lg font-semibold', item.n ? 'text-foreground' : 'text-muted-foreground')}>{item.n}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance, last 30 days</CardTitle>
          <SeriesLegend />
        </CardHeader>
        <CardContent>
          <TrendLineChart data={d.trend} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By department today</CardTitle>
          </CardHeader>
          <CardContent>
            <DepartmentBars data={d.departments} />
            <DepartmentLegend className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leave taken this year</CardTitle>
          </CardHeader>
          <CardContent>
            {d.leaveByType.length ? <LeaveDonut data={d.leaveByType} /> : <EmptyState title="No approved leave yet" className="py-6" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>On leave today</CardTitle>
            <Link href="/calendar" className="text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
              Team calendar
            </Link>
          </CardHeader>
          <CardContent>
            {d.onLeaveToday.length === 0 ? (
              <EmptyState tone="leave" title="Everyone is around" description="Approved leave covering today shows here." className="py-6" />
            ) : (
              <ul className="divide-y">
                {d.onLeaveToday.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <span className="truncate text-[13px] text-muted-foreground">{p.department}</span>
                    </span>
                    <Badge tone="leave">{p.leaveType}</Badge>
                    <span className="hidden text-[13px] text-muted-foreground sm:inline">until {fmtDate(p.until)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Accounts waiting for approval</CardTitle>
            <Link href="/employees/pending" className="text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
              Review all
            </Link>
          </CardHeader>
          <CardContent>
            <PendingAccounts users={d.pendingAccounts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
