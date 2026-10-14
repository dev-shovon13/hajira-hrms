'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { UserPlus } from 'lucide-react';
import { ROLE_LABELS, ROLES, USER_STATUSES, type UserRow } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Badge, PageHeader } from '@/components/common';
import { DataTable, useTableQuery } from '@/components/data-table';
import { InviteDialog } from '@/features/employees/invite-dialog';
import { useDepartments } from '@/hooks/use-options';
import { useNavCounts } from '@/hooks/use-counts';
import { errorMessage, getPage } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { STATUS_LABEL, STATUS_TONE } from '@/features/employees/status';

export default function EmployeesPage() {
  const router = useRouter();
  const table = useTableQuery({ sort: 'name', order: 'asc' });
  const departments = useDepartments();
  const counts = useNavCounts();
  const [dept, setDept] = React.useState('all');
  const [role, setRole] = React.useState('all');
  const [status, setStatus] = React.useState('all');
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const q = useQuery({
    queryKey: ['users', 'list', table.params, dept, role, status],
    queryFn: () => getPage<UserRow>('/users', { ...table.params, departmentId: dept, role, status }),
    placeholderData: keepPreviousData,
  });

  const columns = React.useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        enableSorting: true,
        cell: ({ row: { original: u } }) => (
          <span className="flex items-center gap-3">
            <Avatar name={u.name} src={u.avatarUrl} size="sm" />
            <span className="grid leading-tight">
              <Link href={`/employees/${u.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{u.name}</Link>
              <span className="text-[13px] text-muted-foreground">{u.email}</span>
            </span>
          </span>
        ),
      },
      { id: 'employeeCode', header: 'Code', enableSorting: true, cell: ({ row }) => <span className="tabular text-muted-foreground">{row.original.employeeCode ?? '—'}</span> },
      {
        id: 'department',
        header: 'Department',
        enableSorting: true,
        cell: ({ row: { original: u } }) => (
          <span className="grid leading-tight">
            <span>{u.department?.name ?? '—'}</span>
            <span className="text-[13px] text-muted-foreground">{u.designation?.title}</span>
          </span>
        ),
      },
      { id: 'role', header: 'Role', enableSorting: true, cell: ({ row }) => ROLE_LABELS[row.original.role] },
      { id: 'manager', header: 'Reports to', enableSorting: false, cell: ({ row }) => <span className="text-muted-foreground">{row.original.manager?.name ?? '—'}</span> },
      { id: 'status', header: 'Status', enableSorting: true, cell: ({ row }) => <Badge tone={STATUS_TONE[row.original.status]} dashed={row.original.status === 'PENDING' || row.original.status === 'INVITED'}>{STATUS_LABEL[row.original.status]}</Badge> },
      { id: 'joinDate', header: 'Joined', enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{row.original.joinDate ? fmtDate(row.original.joinDate) : '—'}</span> },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone in the company. Open a person to change their role, manager, department or shift."
        actions={
          <>
            {counts.accounts > 0 && (
              <Button variant="outline" asChild>
                <Link href="/employees/pending">
                  {counts.accounts} awaiting approval
                </Link>
              </Button>
            )}
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite employee
            </Button>
          </>
        }
      />
      <DataTable
        caption="Employees"
        columns={columns}
        data={q.data?.rows}
        meta={q.data?.meta}
        query={table}
        loading={q.isLoading}
        error={q.error ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search name, email, code, phone"
        onRowClick={(u) => router.push(`/employees/${u.id}`)}
        filters={
          <>
            <Select value={dept} onValueChange={(v) => { setDept(v); table.reset(); }}>
              <SelectTrigger className="sm:w-48" aria-label="Department"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => { setRole(v); table.reset(); }}>
              <SelectTrigger className="sm:w-36" aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any role</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); table.reset(); }}>
              <SelectTrigger className="sm:w-44" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {USER_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        empty={{ title: 'No employees yet', description: 'Invite your first employee, or approve a registration.', action: <Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite employee</Button> }}
      />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
