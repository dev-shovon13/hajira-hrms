'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { leaveTypeSchema, type LeaveTypeDto, type LeaveTypeInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, Input, Skeleton, Switch } from '@/components/ui/primitives';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge, PageHeader } from '@/components/common';
import { useLeaveTypes } from '@/hooks/use-options';
import { errorMessage, send } from '@/lib/api';
import { leaveColor } from '@/lib/leave-colors';

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const types = useLeaveTypes(true);
  const [editing, setEditing] = React.useState<LeaveTypeDto | 'new' | null>(null);
  const [archiving, setArchiving] = React.useState<LeaveTypeDto | null>(null);
  const archive = useMutation({
    mutationFn: (id: string) => send('delete', `/leave-types/${id}`),
    onSuccess: ({ message }) => { toast.success(message); setArchiving(null); void qc.invalidateQueries({ queryKey: ['leave-types'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Leave types" description="Yearly quotas, carry-forward, the longest single stretch allowed, and when a document is required." actions={<Button onClick={() => setEditing('new')}><Plus /> New leave type</Button>} />
      <Card className="overflow-hidden">
        {types.isLoading ? <Skeleton className="m-5 h-64" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Leave types</caption>
              <thead><tr className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground">
                <th scope="col" className="h-11 px-5 font-medium">Type</th><th scope="col" className="px-3 font-medium">Quota / year</th>
                <th scope="col" className="px-3 font-medium">Carry forward</th><th scope="col" className="px-3 font-medium">Max in a row</th>
                <th scope="col" className="px-3 font-medium">Rules</th><th scope="col" className="px-5"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {types.data?.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="h-14 px-5">
                      <span className="flex items-center gap-2.5">
                        <span className="h-[3px] w-4 rounded-full" style={{ background: leaveColor(t.code, t.color) }} aria-hidden />
                        <span className="font-medium">{t.name}</span>
                        <span className="tabular rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{t.code}</span>
                        {!t.isActive && <Badge tone="neutral">Archived</Badge>}
                      </span>
                    </td>
                    <td className="tabular px-3">{t.isPaid ? `${t.yearlyQuota} days` : 'Unpaid'}</td>
                    <td className="tabular px-3">{t.carryForward ? `Up to ${t.maxCarryForward}` : 'No'}</td>
                    <td className="tabular px-3">{t.maxConsecutiveDays ?? '—'}</td>
                    <td className="px-3 text-[13px] text-muted-foreground">
                      {[t.allowHalfDay && 'half days', t.requiresAttachmentAfterDays && `document after ${t.requiresAttachmentAfterDays} day${t.requiresAttachmentAfterDays === 1 ? '' : 's'}`].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-5 text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}><Pencil /></Button>
                      {t.isActive && <Button variant="ghost" size="icon-sm" onClick={() => setArchiving(t)} aria-label={`Archive ${t.name}`}><Archive /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <LeaveTypeDialog value={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={Boolean(archiving)} onOpenChange={(o) => !o && setArchiving(null)} title={`Archive ${archiving?.name}?`} description="Nobody can request it any more. Past requests and balances stay as they are." confirmLabel="Archive" loading={archive.isPending} onConfirm={() => archiving && archive.mutate(archiving.id)} />
    </>
  );
}

function LeaveTypeDialog({ value, onClose }: { value: LeaveTypeDto | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = value && value !== 'new' ? value : null;
  const blank: LeaveTypeInput = { name: '', code: '', yearlyQuota: 10, isPaid: true, carryForward: false, maxCarryForward: 0, maxConsecutiveDays: null, allowHalfDay: true, requiresAttachmentAfterDays: null, color: '#2F6FD6', isActive: true };
  const form = useForm<LeaveTypeInput>({ resolver: zodResolver(leaveTypeSchema), defaultValues: blank });
  React.useEffect(() => {
    if (value) form.reset(editing ? { ...editing, color: editing.color ?? '#2F6FD6' } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const [isPaid, carry] = useWatch({ control: form.control, name: ['isPaid', 'carryForward'] });

  const save = useMutation({
    mutationFn: (v: LeaveTypeInput) => (editing ? send('put', `/leave-types/${editing.id}`, v) : send('post', '/leave-types', v)),
    onSuccess: ({ message }) => { toast.success(message); for (const k of [['leave-types'], ['leave']]) void qc.invalidateQueries({ queryKey: k }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const num = (v: string) => (v === '' ? null : Number(v));

  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : 'New leave type'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>Code</FormLabel><FormControl><Input className="uppercase" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="color" render={({ field }) => <FormItem><FormLabel>Colour</FormLabel><FormControl><Input type="color" className="h-10 p-1" {...field} /></FormControl></FormItem>} />
            </div>
            <FormField control={form.control} name="isPaid" render={({ field }) => <label className="flex items-center gap-3 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Paid leave with a yearly quota</label>} />
            <div className="grid gap-4 sm:grid-cols-3">
              {isPaid && <FormField control={form.control} name="yearlyQuota" render={({ field }) => <FormItem><FormLabel>Days per year</FormLabel><FormControl><Input type="number" min={0} step={0.5} {...field} /></FormControl><FormMessage /></FormItem>} />}
              <FormField control={form.control} name="maxConsecutiveDays" render={({ field }) => <FormItem><FormLabel>Max in a row</FormLabel><FormControl><Input type="number" min={1} value={field.value ?? ''} onChange={(e) => field.onChange(num(e.target.value))} /></FormControl><FormDescription>Working days</FormDescription></FormItem>} />
              <FormField control={form.control} name="requiresAttachmentAfterDays" render={({ field }) => <FormItem><FormLabel>Document after</FormLabel><FormControl><Input type="number" min={1} value={field.value ?? ''} onChange={(e) => field.onChange(num(e.target.value))} /></FormControl><FormDescription>Days; blank = never</FormDescription></FormItem>} />
            </div>
            {isPaid && (
              <div className="grid gap-4 sm:grid-cols-[auto_10rem] sm:items-end">
                <FormField control={form.control} name="carryForward" render={({ field }) => <label className="flex items-center gap-3 text-sm sm:pb-2.5"><Switch checked={field.value} onCheckedChange={field.onChange} /> Carry unused days into next year</label>} />
                {carry && <FormField control={form.control} name="maxCarryForward" render={({ field }) => <FormItem><FormLabel>Carry at most</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl></FormItem>} />}
              </div>
            )}
            <FormField control={form.control} name="allowHalfDay" render={({ field }) => <label className="flex items-center gap-3 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Allow half days</label>} />
            {editing && <FormField control={form.control} name="isActive" render={({ field }) => <label className="flex items-center gap-3 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Active</label>} />}
            {editing && <p className="text-[13px] text-muted-foreground">Changing the quota updates everyone’s allocation for this year.</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Create leave type'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
