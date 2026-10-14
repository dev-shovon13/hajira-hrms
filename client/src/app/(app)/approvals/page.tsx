'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { LeaveRequestDto, RegularizationDto } from '@hajira/shared';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageHeader } from '@/components/common';
import { LeaveRequestItem, RegularizationItem } from '@/features/approvals/decision';
import { useRole } from '@/hooks/use-session';
import { errorMessage, getPage } from '@/lib/api';
import { DEFAULT_TZ } from '@/lib/format';

const LIMIT = 10;

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t px-5 py-3 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="tabular text-muted-foreground">{page} / {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

function Approvals() {
  const { isHR } = useRole();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'regularization' ? 'regularization' : 'leave';
  const [leavePage, setLeavePage] = React.useState(1);
  const [regPage, setRegPage] = React.useState(1);

  const leave = useQuery({
    queryKey: ['leave', 'approvals', leavePage],
    queryFn: () => getPage<LeaveRequestDto>('/leave/requests', { scope: 'approvals', page: leavePage, limit: LIMIT, sort: 'createdAt', order: 'asc' }),
    placeholderData: keepPreviousData,
  });
  const reg = useQuery({
    queryKey: ['regularizations', 'approvals', regPage],
    queryFn: () => getPage<RegularizationDto>('/regularizations', { scope: 'approvals', page: regPage, limit: LIMIT, sort: 'createdAt', order: 'asc' }),
    placeholderData: keepPreviousData,
  });

  const count = (n?: number) => (n ? <span className="tabular rounded-full bg-marigold px-1.5 text-[11px] font-bold leading-5 text-marigold-foreground">{n}</span> : null);

  return (
    <>
      <PageHeader
        title="Approvals"
        description={
          isHR
            ? 'Everything waiting across the company, oldest first. HR can approve at any step; your approval completes the chain.'
            : 'Requests from your team, oldest first. Approved leave moves on to HR.'
        }
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === 'leave' ? '/approvals' : '/approvals?tab=regularization')}>
        <TabsList>
          <TabsTrigger value="leave">Leave {count(leave.data?.meta.total)}</TabsTrigger>
          <TabsTrigger value="regularization">Corrections {count(reg.data?.meta.total)}</TabsTrigger>
        </TabsList>
        <TabsContent value="leave">
          <Card className="overflow-hidden">
            {leave.isLoading ? (
              <div className="grid gap-4 p-5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
            ) : leave.error ? (
              <ErrorState message={errorMessage(leave.error)} onRetry={() => leave.refetch()} />
            ) : !leave.data?.rows.length ? (
              <EmptyState tone="present" title="No leave waiting for you" description="New requests arrive here and in your notifications." />
            ) : (
              <>
                <div className="divide-y">{leave.data.rows.map((r) => <LeaveRequestItem key={r.id} r={r} />)}</div>
                <Pager page={leavePage} totalPages={leave.data.meta.totalPages} onPage={setLeavePage} />
              </>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="regularization">
          <Card className="overflow-hidden">
            {reg.isLoading ? (
              <div className="grid gap-4 p-5">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
            ) : reg.error ? (
              <ErrorState message={errorMessage(reg.error)} onRetry={() => reg.refetch()} />
            ) : !reg.data?.rows.length ? (
              <EmptyState tone="present" title="No corrections waiting" description="When someone asks to fix a check-in or check-out, it shows up here." />
            ) : (
              <>
                <div className="divide-y">{reg.data.rows.map((r) => <RegularizationItem key={r.id} r={r} tz={DEFAULT_TZ} />)}</div>
                <Pager page={regPage} totalPages={reg.data.meta.totalPages} onPage={setRegPage} />
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense>
      <Approvals />
    </Suspense>
  );
}
