'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_LABELS, ROLES, type Role, type UserRow } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Card, Label, Skeleton, Textarea } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge, EmptyState, ErrorState, PageHeader } from '@/components/common';
import { usePeople, useShifts } from '@/hooks/use-options';
import { useRole } from '@/hooks/use-session';
import { errorMessage, getPage, send } from '@/lib/api';
import { fmtAgo } from '@/lib/format';

const NONE = '__none__';

function PendingRow({ u }: { u: UserRow }) {
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const managers = usePeople(['MANAGER', 'HR', 'ADMIN']);
  const shifts = useShifts();
  const [role, setRole] = React.useState<Role>('EMPLOYEE');
  const [managerId, setManagerId] = React.useState(NONE);
  const [shiftId, setShiftId] = React.useState(NONE);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const done = () => {
    for (const k of [['users'], ['counts'], ['dashboard']]) void qc.invalidateQueries({ queryKey: k });
  };
  const approve = useMutation({
    mutationFn: () => send('post', `/users/${u.id}/approve`, { role, managerId: managerId === NONE ? null : managerId, shiftId: shiftId === NONE ? null : shiftId }),
    onSuccess: ({ message }) => { toast.success(message); done(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: () => send('post', `/users/${u.id}/reject`, { comment: reason }),
    onSuccess: ({ message }) => { toast.success(message); setRejecting(false); done(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <li className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="flex items-start gap-3">
        <Avatar name={u.name} src={u.avatarUrl} />
        <div className="grid gap-1">
          <p className="font-semibold">{u.name}</p>
          <p className="text-sm text-muted-foreground">
            {u.email} · {u.phone ?? 'no phone'}
          </p>
          <p className="text-sm">
            {u.designation?.title} · {u.department?.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {u.emailVerified ? <Badge tone="present">Email confirmed</Badge> : <Badge tone="late" dashed>Email not confirmed yet</Badge>}
            <span className="text-[13px] text-muted-foreground">registered {fmtAgo(u.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:w-[36rem]">
        <div className="grid gap-1.5">
          <Label className="text-[13px] text-muted-foreground">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.filter((r) => r !== 'ADMIN' || isAdmin).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[13px] text-muted-foreground">Reports to</Label>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No manager</SelectItem>
              {managers.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[13px] text-muted-foreground">Shift</Label>
          <Select value={shiftId} onValueChange={setShiftId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Department default</SelectItem>
              {shifts.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 sm:col-span-3 sm:justify-end">
          <Button variant="outline" onClick={() => setRejecting(true)}><X /> Reject</Button>
          <Button variant="success" onClick={() => approve.mutate()} loading={approve.isPending}>{!approve.isPending && <Check />} Approve account</Button>
        </div>
      </div>
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reject {u.name.split(' ')[0]}&apos;s registration?</DialogTitle>
            <DialogDescription>They will get an email with your reason and will not be able to sign in.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`reason-${u.id}`}>Reason</Label>
            <Textarea id={`reason-${u.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. We could not match this registration to a staff record." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="destructive" disabled={reason.trim().length < 3} loading={reject.isPending} onClick={() => reject.mutate()}>Reject registration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export default function PendingAccountsPage() {
  const q = useQuery({ queryKey: ['users', 'pending'], queryFn: () => getPage<UserRow>('/users', { status: 'PENDING', limit: 50, sort: 'createdAt', order: 'asc' }) });
  return (
    <>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Employees
      </Link>
      <PageHeader title="Accounts awaiting approval" description="People who registered themselves. Choose their role, manager and shift as you approve them." />
      <Card className="overflow-hidden">
        {q.isLoading ? (
          <div className="grid gap-4 p-5">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : !q.data?.rows.length ? (
          <EmptyState tone="present" title="No one is waiting" description="New registrations land here, and HR gets a notification for each." />
        ) : (
          <ul className="divide-y">{q.data.rows.map((u) => <PendingRow key={u.id} u={u} />)}</ul>
        )}
      </Card>
    </>
  );
}
