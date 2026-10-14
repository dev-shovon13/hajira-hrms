'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { shiftSchema, WEEKDAYS, type ShiftDto, type ShiftInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, Checkbox, Input, Label, Skeleton, Switch } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge, EmptyState, PageHeader } from '@/components/common';
import { useDepartments, usePeople, useShifts } from '@/hooks/use-options';
import { errorMessage, send } from '@/lib/api';
import { DEFAULT_TZ, todayIn } from '@/lib/format';
import { cn, plural } from '@/lib/utils';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** A 24-hour track with the shift stitched in (wrapping past midnight for night shifts). */
function DayTrack({ s }: { s: Pick<ShiftDto, 'startTime' | 'endTime' | 'graceMinutes' | 'type'> }) {
  const a = toMin(s.startTime);
  const b = toMin(s.endTime);
  const segs = b > a ? [[a, b]] : [[a, 1440], [0, b]];
  return (
    <div className="grid gap-1.5" aria-hidden>
      <div className="relative h-3">
        <div className="stitch-line absolute inset-x-0 top-1/2 h-px -translate-y-1/2 [--gap:4px] [--stitch:4px] [--thread:var(--off)]" />
        {segs.map(([x, y], i) => (
          <div key={i} className={cn('absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full', s.type === 'FLEXIBLE' ? 'stitch-line [--gap:4px] [--stitch:8px] [--thread:var(--leave)]' : 'bg-leave')} style={{ left: `${(x / 1440) * 100}%`, width: `${((y - x) / 1440) * 100}%` }} />
        ))}
        {s.graceMinutes > 0 && <div className="absolute top-0 h-3 border-x border-late bg-late/20" style={{ left: `${(a / 1440) * 100}%`, width: `${(s.graceMinutes / 1440) * 100}%` }} />}
      </div>
      <div className="tabular flex justify-between text-[11px] text-muted-foreground"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </div>
  );
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const shifts = useShifts();
  const [editing, setEditing] = React.useState<ShiftDto | 'new' | null>(null);
  const [assigning, setAssigning] = React.useState<ShiftDto | null>(null);
  const [deleting, setDeleting] = React.useState<ShiftDto | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => send('delete', `/shifts/${id}`),
    onSuccess: ({ message }) => { toast.success(message); setDeleting(null); void qc.invalidateQueries({ queryKey: ['shifts'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Shifts" description="Start and end times, the grace period before a check-in counts as late, and weekly days off." actions={<Button onClick={() => setEditing('new')}><Plus /> New shift</Button>} />
      {shifts.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
      ) : !shifts.data?.length ? (
        <Card><EmptyState title="No shifts yet" description="Create the working hours people check in against." action={<Button onClick={() => setEditing('new')}><Plus /> New shift</Button>} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {shifts.data.map((s) => (
            <Card key={s.id} className="grid gap-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">{s.name}{s.isDefault && <Badge tone="present">Default</Badge>}</h2>
                  <p className="tabular text-figure-sm font-semibold">{s.startTime}–{s.endTime}</p>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(s)} aria-label={`Remove ${s.name}`} disabled={s.isDefault}><Trash2 /></Button>
                </div>
              </div>
              <DayTrack s={s} />
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-[13px] text-muted-foreground">Type</dt><dd>{s.type === 'FIXED' ? 'Fixed' : s.type === 'NIGHT' ? 'Night' : 'Flexible'}</dd></div>
                <div><dt className="text-[13px] text-muted-foreground">Grace</dt><dd className="tabular">{s.type === 'FLEXIBLE' ? 'No lateness' : `${s.graceMinutes} min`}</dd></div>
                <div><dt className="text-[13px] text-muted-foreground">Days off</dt><dd>{s.weeklyOffDays.map((d) => WEEKDAYS[d]).join(', ') || 'None'}</dd></div>
              </dl>
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">{plural(s.assignedCount ?? 0, 'person', 'people')} assigned directly</span>
                <Button variant="outline" size="sm" onClick={() => setAssigning(s)}><Users /> Assign</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ShiftDialog value={editing} onClose={() => setEditing(null)} />
      <AssignDialog shift={assigning} onClose={() => setAssigning(null)} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} title={`Remove the ${deleting?.name} shift?`} description="People assigned to it fall back to their department's shift. Past attendance keeps its record." confirmLabel="Remove shift" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)} />
    </>
  );
}

function ShiftDialog({ value, onClose }: { value: ShiftDto | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = value && value !== 'new' ? value : null;
  const blank: ShiftInput = { name: '', type: 'FIXED', startTime: '09:00', endTime: '18:00', graceMinutes: 15, earlyLeaveGraceMinutes: 10, halfDayMinutes: 240, weeklyOffDays: [5, 6], isDefault: false };
  const form = useForm<ShiftInput>({ resolver: zodResolver(shiftSchema), defaultValues: blank });
  React.useEffect(() => {
    if (value) form.reset(editing ? { name: editing.name, type: editing.type, startTime: editing.startTime, endTime: editing.endTime, graceMinutes: editing.graceMinutes, earlyLeaveGraceMinutes: editing.earlyLeaveGraceMinutes, halfDayMinutes: editing.halfDayMinutes, weeklyOffDays: editing.weeklyOffDays, isDefault: editing.isDefault } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const live = useWatch({ control: form.control }) as ShiftInput;

  const save = useMutation({
    mutationFn: (v: ShiftInput) => (editing ? send('put', `/shifts/${editing.id}`, v) : send('post', '/shifts', v)),
    onSuccess: ({ message }) => { toast.success(message); void qc.invalidateQueries({ queryKey: ['shifts'] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={Boolean(value)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : 'New shift'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="General" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="FIXED">Fixed hours</SelectItem><SelectItem value="NIGHT">Night (ends next day)</SelectItem><SelectItem value="FLEXIBLE">Flexible (no lateness)</SelectItem></SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="startTime" render={({ field }) => <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="endTime" render={({ field }) => <FormItem><FormLabel>Ends</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="graceMinutes" render={({ field }) => <FormItem><FormLabel>Grace (minutes)</FormLabel><FormControl><Input type="number" min={0} max={120} {...field} /></FormControl><FormDescription>Check-ins after start + grace are late.</FormDescription><FormMessage /></FormItem>} />
              <FormField control={form.control} name="halfDayMinutes" render={({ field }) => <FormItem><FormLabel>Half day below (minutes)</FormLabel><FormControl><Input type="number" min={60} max={720} {...field} /></FormControl><FormDescription>Worked less than this = half day.</FormDescription><FormMessage /></FormItem>} />
            </div>
            {live.startTime && live.endTime && <DayTrack s={{ startTime: live.startTime, endTime: live.endTime, graceMinutes: Number(live.graceMinutes) || 0, type: live.type }} />}
            <FormField control={form.control} name="weeklyOffDays" render={({ field }) => (
              <FormItem>
                <FormLabel>Weekly days off</FormLabel>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Weekly days off">
                  {WEEKDAYS.map((d, i) => {
                    const on = field.value.includes(i);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x) => x !== i) : [...field.value, i])}
                        className={cn('h-9 min-w-12 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="isDefault" render={({ field }) => (
              <label className="flex items-center gap-3 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Company default (used when no other shift applies)</label>
            )} />
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>{editing ? 'Save shift' : 'Create shift'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ shift, onClose }: { shift: ShiftDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const departments = useDepartments();
  const people = usePeople(undefined, Boolean(shift));
  const [tab, setTab] = React.useState<'department' | 'people'>('department');
  const [dept, setDept] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState('');
  const [from, setFrom] = React.useState(todayIn(DEFAULT_TZ));
  React.useEffect(() => { if (shift) { setDept(''); setPicked([]); setFilter(''); } }, [shift]);

  const assign = useMutation({
    mutationFn: () => send('post', `/shifts/${shift!.id}/assign`, tab === 'department' ? { departmentId: dept, effectiveFrom: from } : { userIds: picked, effectiveFrom: from }),
    onSuccess: ({ message }) => { toast.success(message); for (const k of [['shifts'], ['departments'], ['dashboard']]) void qc.invalidateQueries({ queryKey: k }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const list = (people.data ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Dialog open={Boolean(shift)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {shift?.name}</DialogTitle>
          <DialogDescription>Applies from the date you choose. Earlier days keep the shift they had.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'department' | 'people')}>
          <TabsList><TabsTrigger value="department">A whole department</TabsTrigger><TabsTrigger value="people">Specific people</TabsTrigger></TabsList>
          <TabsContent value="department">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger aria-label="Department"><SelectValue placeholder="Choose a department" /></SelectTrigger>
              <SelectContent>{departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-2 text-[13px] text-muted-foreground">Everyone in it is assigned, and it becomes the department’s default for new joiners.</p>
          </TabsContent>
          <TabsContent value="people" className="grid gap-2">
            <Input placeholder="Filter people" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter people" />
            <ul className="max-h-60 overflow-y-auto rounded-lg border">
              {list.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent">
                    <Checkbox checked={picked.includes(p.id)} onCheckedChange={(v) => setPicked(v ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />
                    {p.name}<span className="tabular ml-auto text-xs text-muted-foreground">{p.employeeCode}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted-foreground">{plural(picked.length, 'person', 'people')} selected</p>
          </TabsContent>
        </Tabs>
        <div className="grid gap-2"><Label htmlFor="assign-from">Effective from</Label><Input id="assign-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => assign.mutate()} loading={assign.isPending} disabled={tab === 'department' ? !dept : picked.length === 0}>Assign shift</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
