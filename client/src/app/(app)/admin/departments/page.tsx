'use client';

import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { departmentSchema, type DepartmentDto, type DepartmentInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/common';
import { DataTable, useTableQuery } from '@/components/data-table';
import { usePeople, useShifts } from '@/hooks/use-options';
import { errorMessage, getPage, send } from '@/lib/api';

const NONE = '__none__';

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const table = useTableQuery({ sort: 'name', order: 'asc' });
  const [editing, setEditing] = React.useState<DepartmentDto | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<DepartmentDto | null>(null);
  const q = useQuery({ queryKey: ['departments', 'list', table.params], queryFn: () => getPage<DepartmentDto>('/departments', table.params), placeholderData: keepPreviousData });

  const remove = useMutation({
    mutationFn: (id: string) => send('delete', `/departments/${id}`),
    onSuccess: ({ message }) => { toast.success(message); setDeleting(null); void qc.invalidateQueries({ queryKey: ['departments'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns = React.useMemo<ColumnDef<DepartmentDto, unknown>[]>(() => [
    { id: 'name', header: 'Department', enableSorting: true, cell: ({ row: { original: d } }) => (
      <span className="grid leading-tight"><span className="font-medium">{d.name}</span>{d.description && <span className="line-clamp-1 text-[13px] text-muted-foreground">{d.description}</span>}</span>
    ) },
    { id: 'code', header: 'Code', enableSorting: true, cell: ({ row }) => <span className="tabular rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{row.original.code}</span> },
    { id: 'head', header: 'Head', enableSorting: false, cell: ({ row }) => row.original.head?.name ?? <span className="text-muted-foreground">—</span> },
    { id: 'shift', header: 'Default shift', enableSorting: false, cell: ({ row }) => row.original.defaultShift?.name ?? <span className="text-muted-foreground">Company default</span> },
    { id: 'people', header: 'People', enableSorting: false, meta: { align: 'right' }, cell: ({ row }) => <span className="tabular">{row.original.employeeCount}</span> },
    { id: 'actions', header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: 'right' }, cell: ({ row }) => (
      <span className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.name}`}><Pencil /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(row.original)} aria-label={`Delete ${row.original.name}`}><Trash2 /></Button>
      </span>
    ) },
  ], []);

  return (
    <>
      <PageHeader title="Departments" description="Each department can carry a default shift; people without their own shift follow it." actions={<Button onClick={() => setEditing('new')}><Plus /> New department</Button>} />
      <DataTable caption="Departments" columns={columns} data={q.data?.rows} meta={q.data?.meta} query={table} loading={q.isLoading} error={q.error ? errorMessage(q.error) : null} searchPlaceholder="Search departments" empty={{ title: 'No departments yet', action: <Button onClick={() => setEditing('new')}><Plus /> New department</Button> }} />
      <DepartmentDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={deleting?.employeeCount ? `${deleting.employeeCount} people still belong to it. Move them first; the delete will be refused until then.` : 'The department is archived; its history stays in reports.'}
        confirmLabel="Delete department"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}

function DepartmentDialog({ value, onClose }: { value: DepartmentDto | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = value && value !== 'new' ? value : null;
  const people = usePeople(['MANAGER', 'HR', 'ADMIN'], Boolean(value));
  const shifts = useShifts();
  const form = useForm<DepartmentInput>({ resolver: zodResolver(departmentSchema), defaultValues: { name: '', code: '', description: '', headId: null, defaultShiftId: null } });
  React.useEffect(() => {
    if (value) form.reset(editing ? { name: editing.name, code: editing.code, description: editing.description ?? '', headId: editing.head?.id ?? null, defaultShiftId: editing.defaultShift?.id ?? null } : { name: '', code: '', description: '', headId: null, defaultShiftId: null });
  }, [value, editing, form]);

  const save = useMutation({
    mutationFn: (v: DepartmentInput) => (editing ? send('put', `/departments/${editing.id}`, v) : send('post', '/departments', v)),
    onSuccess: ({ message }) => { toast.success(message); void qc.invalidateQueries({ queryKey: ['departments'] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : 'New department'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>Code</FormLabel><FormControl><Input className="uppercase" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea className="min-h-20" {...field} /></FormControl><FormMessage /></FormItem>} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="headId" render={({ field }) => (
                <FormItem><FormLabel>Head</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value={NONE}>No head</SelectItem>{people.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="defaultShiftId" render={({ field }) => (
                <FormItem><FormLabel>Default shift</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value={NONE}>Company default</SelectItem>{shifts.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Create department'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
