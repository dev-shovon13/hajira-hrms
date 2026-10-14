'use client';

import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { designationSchema, type DesignationDto, type DesignationInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/common';
import { DataTable, useTableQuery } from '@/components/data-table';
import { useDepartments } from '@/hooks/use-options';
import { errorMessage, getPage, send } from '@/lib/api';

const NONE = '__none__';

export default function DesignationsPage() {
  const qc = useQueryClient();
  const departments = useDepartments();
  const table = useTableQuery({ sort: 'level', order: 'asc' });
  const [dept, setDept] = React.useState('all');
  const [editing, setEditing] = React.useState<DesignationDto | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<DesignationDto | null>(null);
  const q = useQuery({ queryKey: ['designations', 'list', table.params, dept], queryFn: () => getPage<DesignationDto>('/designations', { ...table.params, departmentId: dept }), placeholderData: keepPreviousData });

  const remove = useMutation({
    mutationFn: (id: string) => send('delete', `/designations/${id}`),
    onSuccess: ({ message }) => { toast.success(message); setDeleting(null); void qc.invalidateQueries({ queryKey: ['designations'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns = React.useMemo<ColumnDef<DesignationDto, unknown>[]>(() => [
    { id: 'title', header: 'Title', enableSorting: true, cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
    { id: 'department', header: 'Department', enableSorting: true, cell: ({ row }) => row.original.department?.name ?? <span className="text-muted-foreground">Company-wide</span> },
    { id: 'level', header: 'Level', enableSorting: true, cell: ({ row }) => <span className="tabular">{row.original.level ?? '—'}</span> },
    { id: 'people', header: 'People', enableSorting: false, meta: { align: 'right' }, cell: ({ row }) => <span className="tabular">{row.original.employeeCount}</span> },
    { id: 'actions', header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: 'right' }, cell: ({ row }) => (
      <span className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.title}`}><Pencil /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(row.original)} aria-label={`Delete ${row.original.title}`}><Trash2 /></Button>
      </span>
    ) },
  ], []);

  return (
    <>
      <PageHeader title="Designations" description="Job titles. Tie one to a department, or leave it company-wide." actions={<Button onClick={() => setEditing('new')}><Plus /> New designation</Button>} />
      <DataTable
        caption="Designations" columns={columns} data={q.data?.rows} meta={q.data?.meta} query={table} loading={q.isLoading} error={q.error ? errorMessage(q.error) : null}
        searchPlaceholder="Search titles"
        filters={
          <Select value={dept} onValueChange={(v) => { setDept(v); table.reset(); }}>
            <SelectTrigger className="sm:w-52" aria-label="Department"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All departments</SelectItem>{departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        }
        empty={{ title: 'No designations yet' }}
      />
      <DesignationDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.title}?`} description={deleting?.employeeCount ? `${deleting.employeeCount} people hold this title; reassign them first.` : 'This cannot be undone.'} confirmLabel="Delete designation" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)} />
    </>
  );
}

function DesignationDialog({ value, onClose }: { value: DesignationDto | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const departments = useDepartments();
  const editing = value && value !== 'new' ? value : null;
  const form = useForm<DesignationInput>({ resolver: zodResolver(designationSchema), defaultValues: { title: '', departmentId: null, level: undefined } });
  React.useEffect(() => {
    if (value) form.reset(editing ? { title: editing.title, departmentId: editing.department?.id ?? null, level: editing.level ?? undefined } : { title: '', departmentId: null, level: undefined });
  }, [value, editing, form]);
  const save = useMutation({
    mutationFn: (v: DesignationInput) => (editing ? send('put', `/designations/${editing.id}`, v) : send('post', '/designations', v)),
    onSuccess: ({ message }) => { toast.success(message); void qc.invalidateQueries({ queryKey: ['designations'] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>{editing ? 'Edit designation' : 'New designation'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4">
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value={NONE}>Company-wide</SelectItem>{departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="level" render={({ field }) => <FormItem><FormLabel>Level</FormLabel><FormControl><Input type="number" min={1} max={20} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Create'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
