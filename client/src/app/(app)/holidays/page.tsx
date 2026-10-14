'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { holidaySchema, type HolidayDto, type HolidayInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, Input, Skeleton, Textarea } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge, EmptyState, ErrorState, PageHeader } from '@/components/common';
import { useRole } from '@/hooks/use-session';
import { errorMessage, get, send } from '@/lib/api';
import { DEFAULT_TZ, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function HolidaysPage() {
  const { isHR } = useRole();
  const qc = useQueryClient();
  const today = todayIn(DEFAULT_TZ);
  const [year, setYear] = React.useState(Number(today.slice(0, 4)));
  const [editing, setEditing] = React.useState<HolidayDto | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<HolidayDto | null>(null);

  const q = useQuery({ queryKey: ['holidays', year], queryFn: () => get<HolidayDto[]>('/holidays', { params: { year } }) });
  const remove = useMutation({
    mutationFn: (id: string) => send('delete', `/holidays/${id}`),
    onSuccess: ({ message }) => {
      toast.success(message);
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const byMonth = React.useMemo(() => {
    const map = new Map<string, HolidayDto[]>();
    for (const h of q.data ?? []) {
      const key = h.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), h]);
    }
    return [...map.entries()];
  }, [q.data]);
  const next = q.data?.find((h) => h.date >= today);

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Public and company holidays. They are never counted as leave days or absences."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => setYear(year - 1)} aria-label="Previous year">
                <ChevronLeft />
              </Button>
              <span className="tabular w-14 text-center font-semibold">{year}</span>
              <Button variant="outline" size="icon-sm" onClick={() => setYear(year + 1)} aria-label="Next year">
                <ChevronRight />
              </Button>
            </div>
            {isHR && (
              <Button onClick={() => setEditing('new')}>
                <Plus /> Add holiday
              </Button>
            )}
          </>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : byMonth.length === 0 ? (
        <Card>
          <EmptyState tone="holiday" title={`No holidays for ${year} yet`} description={isHR ? 'Add public and company holidays so leave and attendance skip them.' : 'HR has not published this year’s holidays.'} />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {byMonth.map(([month, items]) => (
            <Card key={month} className="p-5">
              <h2 className="mb-3 font-semibold">{format(parseISO(`${month}-01`), 'MMMM')}</h2>
              <ul className="divide-y">
                {items.map((h) => (
                  <li key={h.id} className={cn('group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 py-3 first:pt-0 last:pb-0', h.date < today && 'opacity-60')}>
                    <span className="grid justify-items-center rounded-lg bg-holiday-wash py-1.5 text-holiday-ink">
                      <span className="tabular text-lg font-semibold leading-none">{format(parseISO(h.date), 'd')}</span>
                      <span className="text-[11px] font-medium">{format(parseISO(h.date), 'EEE')}</span>
                    </span>
                    <span className="grid gap-1">
                      <span className="font-medium leading-snug">{h.name}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={h.type === 'PUBLIC' ? 'holiday' : 'leave'}>{h.type === 'PUBLIC' ? 'Public' : 'Company'}</Badge>
                        {next?.id === h.id && <Badge tone="present">Next up</Badge>}
                      </span>
                      {h.description && <span className="text-[13px] text-muted-foreground">{h.description}</span>}
                    </span>
                    {isHR && (
                      <span className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(h)} aria-label={`Edit ${h.name}`}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(h)} aria-label={`Delete ${h.name}`}>
                          <Trash2 />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <HolidayDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this holiday?"
        description={deleting ? `${deleting.name} on ${format(parseISO(deleting.date), 'd MMMM yyyy')} will count as a normal working day again.` : ''}
        confirmLabel="Remove holiday"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}

function HolidayDialog({ value, onClose }: { value: HolidayDto | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = value && value !== 'new' ? value : null;
  const form = useForm<HolidayInput>({ resolver: zodResolver(holidaySchema), defaultValues: { name: '', date: '', type: 'PUBLIC', description: '' } });
  React.useEffect(() => {
    if (value) form.reset(editing ? { name: editing.name, date: editing.date, type: editing.type, description: editing.description ?? '' } : { name: '', date: '', type: 'PUBLIC', description: '' });
  }, [value, editing, form]);

  const save = useMutation({
    mutationFn: (v: HolidayInput) => (editing ? send('put', `/holidays/${editing.id}`, v) : send('post', '/holidays', v)),
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['holidays'] });
      void qc.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit holiday' : 'Add a holiday'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Victory Day" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="COMPANY">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Note <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Textarea className="min-h-20" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Add holiday'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
