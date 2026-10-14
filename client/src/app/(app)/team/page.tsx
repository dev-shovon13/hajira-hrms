'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Flag, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, type AttendanceDto, type AttendanceStatus } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Input, Label, Switch, Textarea, Tooltip } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AttendanceBadge, PageHeader } from '@/components/common';
import { DataTable, useTableQuery } from '@/components/data-table';
import { useRole } from '@/hooks/use-session';
import { useDepartments } from '@/hooks/use-options';
import { errorMessage, getPage, send } from '@/lib/api';
import { DEFAULT_TZ, fmtDay, fmtMinutes, fmtTime, todayIn } from '@/lib/format';

const tz = DEFAULT_TZ;

function TeamAttendance() {
  const params = useSearchParams();
  const { isHR } = useRole();
  const departments = useDepartments();
  const today = todayIn(tz);
  const flaggedOnly = params.get('flagged') === 'true';
  const [from, setFrom] = React.useState(flaggedOnly ? '' : today);
  const [to, setTo] = React.useState(flaggedOnly ? '' : today);
  const [status, setStatus] = React.useState('all');
  const [dept, setDept] = React.useState('all');
  const [flagged, setFlagged] = React.useState(flaggedOnly);
  const [editing, setEditing] = React.useState<AttendanceDto | null>(null);
  const table = useTableQuery({ sort: 'date', limit: 20 });

  const q = useQuery({
    queryKey: ['attendance', 'list', table.params, from, to, status, dept, flagged],
    queryFn: () =>
      getPage<AttendanceDto>('/attendance', {
        ...table.params,
        from,
        to,
        status,
        departmentId: dept,
        flagged: flagged ? 'true' : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const columns = React.useMemo<ColumnDef<AttendanceDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Employee',
        enableSorting: true,
        cell: ({ row: { original: a } }) => (
          <span className="flex items-center gap-3">
            <Avatar name={a.user!.name} src={a.user!.avatarUrl} size="sm" />
            <span className="grid leading-tight">
              <span className="font-medium">{a.user!.name}</span>
              <span className="text-[13px] text-muted-foreground">{a.user!.department?.name}</span>
            </span>
          </span>
        ),
      },
      { id: 'date', header: 'Date', enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDay(row.original.date)}</span> },
      { id: 'checkIn', header: 'In', enableSorting: true, cell: ({ row }) => <span className="tabular">{fmtTime(row.original.checkIn, tz)}</span> },
      { id: 'checkOut', header: 'Out', enableSorting: false, cell: ({ row }) => <span className="tabular">{fmtTime(row.original.checkOut, tz)}</span> },
      { id: 'workMinutes', header: 'Worked', enableSorting: true, cell: ({ row }) => <span className="tabular">{row.original.workMinutes ? fmtMinutes(row.original.workMinutes) : '—'}</span> },
      {
        id: 'lateMinutes',
        header: 'Late',
        enableSorting: true,
        cell: ({ row }) => (row.original.lateMinutes ? <span className="tabular text-late-ink">{row.original.lateMinutes}m</span> : <span className="text-muted-foreground">—</span>),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row: { original: a } }) => (
          <span className="flex items-center gap-2">
            <AttendanceBadge status={a.status} />
            {a.isFlagged && (
              <Tooltip content={a.flagReason ?? 'Flagged for review'}>
                <span className="text-absent-ink" aria-label={a.flagReason ?? 'Flagged for review'}>
                  <Flag className="size-4" />
                </span>
              </Tooltip>
            )}
          </span>
        ),
      },
      ...(isHR
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">Actions</span>,
              enableSorting: false,
              meta: { align: 'right' },
              cell: ({ row }: { row: { original: AttendanceDto } }) => (
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.user?.name}'s record`}>
                  <Pencil />
                </Button>
              ),
            } satisfies ColumnDef<AttendanceDto, unknown>,
          ]
        : []),
    ],
    [isHR],
  );

  return (
    <>
      <PageHeader
        title="Team attendance"
        description={isHR ? 'Every attendance record in the company. Edits are recorded in the audit log.' : 'Attendance for the people who report to you.'}
      />
      <DataTable
        caption="Attendance records"
        columns={columns}
        data={q.data?.rows}
        meta={q.data?.meta}
        query={table}
        loading={q.isLoading}
        error={q.error ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search by name or code"
        rowClassName={(a) => (a.isFlagged ? 'bg-absent-wash/40' : undefined)}
        filters={
          <>
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); table.reset(); }} className="w-40" aria-label="From date" />
              <span className="text-muted-foreground">to</span>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); table.reset(); }} className="w-40" aria-label="To date" />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); table.reset(); }}>
              <SelectTrigger className="sm:w-40" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            {isHR && (
              <Select value={dept} onValueChange={(v) => { setDept(v); table.reset(); }}>
                <SelectTrigger className="sm:w-48" aria-label="Department"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={flagged} onCheckedChange={(v) => { setFlagged(v); table.reset(); }} />
              Flagged only
            </label>
          </>
        }
        empty={{ title: 'No records for these filters', description: 'Widen the date range, or check back after people check in.' }}
      />
      <EditRecordDialog record={editing} onClose={() => setEditing(null)} />
    </>
  );
}

const editForm = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  status: z.string(),
  note: z.string().trim().min(3, 'Say why you are editing this record'),
});
type EditForm = z.infer<typeof editForm>;

const toLocalInput = (iso: string | null) => (iso ? formatInTimeZone(iso, tz, "yyyy-MM-dd'T'HH:mm") : '');
const fromLocalInput = (v: string) => (v ? fromZonedTime(v, tz).toISOString() : null);

function EditRecordDialog({ record, onClose }: { record: AttendanceDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm<EditForm>({ resolver: zodResolver(editForm), defaultValues: { checkIn: '', checkOut: '', status: 'auto', note: '' } });
  React.useEffect(() => {
    if (record) form.reset({ checkIn: toLocalInput(record.checkIn), checkOut: toLocalInput(record.checkOut), status: 'auto', note: '' });
  }, [record, form]);

  const save = useMutation({
    mutationFn: (v: EditForm) =>
      send('patch', `/attendance/${record!.id}`, {
        checkIn: fromLocalInput(v.checkIn),
        checkOut: fromLocalInput(v.checkOut),
        ...(v.status !== 'auto' ? { status: v.status as AttendanceStatus } : {}),
        note: v.note,
      }),
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={Boolean(record)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {record?.user?.name}’s record</DialogTitle>
          <DialogDescription>
            {record && fmtDay(record.date)} · times are office time ({tz}). Status is recalculated from the times unless you override it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="checkIn" render={({ field }) => (
                <FormItem><FormLabel>Check-in</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="checkOut" render={({ field }) => (
                <FormItem><FormLabel>Check-out</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="auto">Work it out from the times</SelectItem>
                    {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for the edit</FormLabel>
                <FormControl><Textarea placeholder="Recorded in the audit log" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {record?.isFlagged && <p className="text-[13px] text-muted-foreground"><Label className="sr-only">Flag</Label>Saving clears the “{record.flagReason}” flag.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>Save record</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamPage() {
  return (
    <Suspense>
      <TeamAttendance />
    </Suspense>
  );
}
