'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/primitives';
import { useSession } from '@/hooks/use-session';
import { DEFAULT_TZ, fmtDateLong, greeting, todayIn } from '@/lib/format';
import { EmployeeView } from './employee-view';
import { AdminView, ManagerView } from './team-views';

export function DashboardView() {
  const { data: me } = useSession();
  const [hello, setHello] = React.useState<string | null>(null);
  React.useEffect(() => setHello(`${greeting(DEFAULT_TZ)}, ${me?.name.split(' ')[0] ?? ''}`), [me?.name]);

  if (!me) return <Skeleton className="h-[70vh] rounded-xl" />;
  const isHR = me.role === 'HR' || me.role === 'ADMIN';
  const isManager = me.role === 'MANAGER' || (isHR && me.hasReports);

  const header = (
    <div className="mb-6 grid gap-1 sm:mb-8">
      <h1 className="min-h-[2.25rem] text-[1.75rem] font-semibold leading-tight tracking-[-0.015em] sm:text-[2rem]" suppressHydrationWarning>
        {hello ?? ' '}
      </h1>
      <p className="text-[15px] text-muted-foreground">
        {fmtDateLong(todayIn(DEFAULT_TZ))}
        {me.department && ` · ${me.department.name}`}
        {me.designation && ` · ${me.designation.title}`}
      </p>
    </div>
  );

  if (!isHR && !isManager) {
    return (
      <>
        {header}
        <EmployeeView />
      </>
    );
  }

  const tabs = [
    ...(isHR ? [{ value: 'company', label: 'Company', node: <AdminView /> }] : []),
    ...(isManager ? [{ value: 'team', label: 'My team', node: <ManagerView /> }] : []),
    { value: 'me', label: 'My day', node: <EmployeeView /> },
  ];

  return (
    <>
      {header}
      <Tabs defaultValue={tabs[0].value}>
        <TabsList aria-label="Dashboard view" className="mb-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-5">
            {t.node}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
