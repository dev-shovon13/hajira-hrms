'use client';

import * as React from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Mail, Phone, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_LABELS, ROLES, USER_STATUSES, updateUserSchema, type LeaveBalanceDto, type UpdateUserInput, type UserDetail } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge, ErrorState, Field } from '@/components/common';
import { QuotaStitch } from '@/components/stitch/quota-stitch';
import { MyAttendance } from '@/features/attendance/my-attendance';
import { STATUS_LABEL, STATUS_TONE } from '@/features/employees/status';
import { useDepartments, useDesignations, usePeople, useShifts } from '@/hooks/use-options';
import { useRole, useSession } from '@/hooks/use-session';
import { errorMessage, get, send } from '@/lib/api';
import { fmtAgo, fmtDate } from '@/lib/format';

const NONE = '__none__';

export default function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const { isHR, isAdmin } = useRole();
  const { data: me } = useSession();
  const [deleting, setDeleting] = React.useState(false);

  const q = useQuery({ queryKey: ['users', 'detail', id], queryFn: () => get<UserDetail>(`/users/${id}`) });
  const balances = useQuery({ queryKey: ['leave', 'balances', id], queryFn: () => get<LeaveBalanceDto[]>('/leave/balances', { params: { userId: id } }), enabled: isHR });

  const resend = useMutation({ mutationFn: () => send('post', `/users/${id}/resend-invite`), onSuccess: ({ message }) => toast.success(message), onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({
    mutationFn: () => send('delete', `/users/${id}`),
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['users'] });
      router.replace('/employees');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Skeleton className="h-[70vh] rounded-xl" />;
  if (q.error || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const u = q.data;
  const canDelete = isHR && !u.isSuperAdmin && u.id !== me?.id && (u.role !== 'ADMIN' || isAdmin);

  return (
    <>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Employees
      </Link>

      <div className="mb-6 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-center">
        <Avatar name={u.name} src={u.avatarUrl} size="xl" className="size-20 text-xl" />
        <div className="grid flex-1 gap-1.5">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.015em]">{u.name}</h1>
          <p className="text-muted-foreground">
            {u.designation?.title} · {u.department?.name} · {ROLE_LABELS[u.role]}
            {u.isSuperAdmin && ' · Super admin'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
            {u.employeeCode && <span className="tabular text-sm text-muted-foreground">{u.employeeCode}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {u.status === 'INVITED' && isHR && <Button variant="outline" onClick={() => resend.mutate()} loading={resend.isPending}><Send /> Resend invite</Button>}
          {canDelete && <Button variant="outline" className="text-absent-ink hover:bg-absent-wash hover:text-absent-ink" onClick={() => setDeleting(true)}><Trash2 /> Remove</Button>}
        </div>
      </div>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-5 lg:gap-6">
          <Card>
            <CardHeader><CardTitle>Contact & schedule</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Email"><a href={`mailto:${u.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="size-4 text-muted-foreground" aria-hidden />{u.email}</a></Field>
                <Field label="Mobile">{u.phone ? <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="size-4 text-muted-foreground" aria-hidden />{u.phone}</a> : '—'}</Field>
                <Field label="Reports to">{u.manager?.name ?? '—'}</Field>
                <Field label="Joined">{u.joinDate ? fmtDate(u.joinDate) : '—'}</Field>
                <Field label="Shift">{u.currentShift ? `${u.currentShift.name} · ${u.currentShift.startTime}–${u.currentShift.endTime}` : '—'}</Field>
                <Field label="Last sign-in">{u.lastLoginAt ? fmtAgo(u.lastLoginAt) : 'Never'}</Field>
              </dl>
            </CardContent>
          </Card>
          {isHR && <EditEmployee u={u} />}
          {isHR && balances.data && (
            <Card>
              <CardHeader><CardTitle>Leave balance</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {balances.data.filter((b) => b.leaveType.isPaid && b.allocated > 0).map((b) => (
                    <li key={b.id} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <span className="truncate text-sm">{b.leaveType.name}</span>
                      <QuotaStitch balance={b} />
                      <span className="tabular text-sm"><strong>{b.available}</strong><span className="text-muted-foreground"> / {b.allocated + b.carriedForward + b.adjusted}</span></span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="grid content-start gap-5 lg:gap-6">
          <React.Suspense>
            <MyAttendance userId={u.id} readOnly />
          </React.Suspense>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Remove ${u.name}?`}
        description="They are signed out everywhere and can no longer sign in. Their attendance and leave history stays for reports."
        confirmLabel="Remove employee"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function EditEmployee({ u }: { u: UserDetail }) {
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const { data: me } = useSession();
  const departments = useDepartments();
  const managers = usePeople(['MANAGER', 'HR', 'ADMIN']);
  const shifts = useShifts();
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      role: u.role,
      status: u.status,
      departmentId: u.department?.id,
      designationId: u.designation?.id,
      managerId: u.manager?.id ?? null,
      joinDate: u.joinDate ?? undefined,
    },
  });
  const departmentId = useWatch({ control: form.control, name: 'departmentId' });
  const designations = useDesignations(departmentId);
  const [shiftId, setShiftId] = React.useState(u.currentShift?.id ?? NONE);
  const [shiftFrom, setShiftFrom] = React.useState(new Date().toISOString().slice(0, 10));

  const save = useMutation({
    mutationFn: async (v: UpdateUserInput) => {
      const res = await send('patch', `/users/${u.id}`, v);
      if (shiftId !== NONE && shiftId !== u.currentShift?.id) {
        await send('post', `/shifts/${shiftId}/assign`, { userIds: [u.id], effectiveFrom: shiftFrom });
      }
      return res;
    },
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const self = me?.id === u.id;

  return (
    <Card>
      <CardHeader><CardTitle>Role & placement</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={self || u.isSuperAdmin}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{ROLES.filter((r) => r !== 'ADMIN' || isAdmin || u.role === 'ADMIN').map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={self || u.isSuperAdmin}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{USER_STATUSES.filter((s) => s === 'ACTIVE' || s === 'SUSPENDED' || s === u.status).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('designationId', undefined); }}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="designationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>{designations.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="managerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reports to</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No manager</SelectItem>
                      {managers.data?.filter((m) => m.id !== u.id).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="joinDate" render={({ field }) => (
                <FormItem><FormLabel>Joined</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid gap-2">
                <FormLabelPlain>Shift</FormLabelPlain>
                <Select value={shiftId} onValueChange={setShiftId}>
                  <SelectTrigger aria-label="Shift"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {shiftId === NONE && <SelectItem value={NONE}>Department default</SelectItem>}
                    {shifts.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.startTime}–{s.endTime}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {shiftId !== NONE && shiftId !== u.currentShift?.id && (
                <div className="grid gap-2">
                  <FormLabelPlain>New shift from</FormLabelPlain>
                  <Input type="date" value={shiftFrom} onChange={(e) => setShiftFrom(e.target.value)} aria-label="New shift effective from" />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending}>Save changes</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const FormLabelPlain = ({ children }: { children: React.ReactNode }) => <span className="text-sm font-medium leading-none">{children}</span>;
