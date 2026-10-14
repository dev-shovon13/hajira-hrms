'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { PageHeader } from '@/components/common';
import { useRole } from '@/hooks/use-session';
import { useDepartments } from '@/hooks/use-options';

const TeamCalendar = dynamic(() => import('@/features/calendar/team-calendar'), {
  ssr: false,
  loading: () => <Skeleton className="h-[640px]" />,
});

function useIsNarrow() {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

export default function CalendarPage() {
  const { isHR } = useRole();
  const departments = useDepartments();
  const [dept, setDept] = React.useState('all');
  const narrow = useIsNarrow();

  return (
    <>
      <PageHeader
        title="Team calendar"
        description="Who is away and when. Solid threads are approved leave, dashed ones are still waiting for approval."
        actions={
          isHR && (
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-56" aria-label="Department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.data?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      <Card className="p-3 sm:p-5">
        <TeamCalendar departmentId={dept === 'all' ? undefined : dept} compact={narrow} />
      </Card>
    </>
  );
}
