'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { settingsSchema, type SettingsDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Switch } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/common';
import { useLeaveTypes, useSettings } from '@/hooks/use-options';
import { errorMessage, send } from '@/lib/api';

// The form edits IPs as objects so useFieldArray can key them.
const formSchema = settingsSchema.extend({
  ipRestriction: z.object({ enabled: z.boolean(), allowedIps: z.array(z.object({ value: z.string().trim().min(3, 'Enter an IP or prefix') })) }),
});
type FormValues = z.infer<typeof formSchema>;

const toForm = (s: SettingsDto): FormValues => ({ ...s, ipRestriction: { enabled: s.ipRestriction.enabled, allowedIps: s.ipRestriction.allowedIps.map((value) => ({ value })) } });

export default function SettingsPage() {
  const settings = useSettings();
  if (settings.isLoading || !settings.data) return <><PageHeader title="Settings" /><Skeleton className="h-[60vh] rounded-xl" /></>;
  return <SettingsForm initial={settings.data} />;
}

function SettingsForm({ initial }: { initial: SettingsDto }) {
  const qc = useQueryClient();
  const leaveTypes = useLeaveTypes();
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toForm(initial) });
  const ips = useFieldArray({ control: form.control, name: 'ipRestriction.allowedIps' });
  const [ipOn, lateOn, levels] = useWatch({ control: form.control, name: ['ipRestriction.enabled', 'latePolicy.enabled', 'approvalFlow.levels'] });

  const save = useMutation({
    mutationFn: (v: FormValues) => send<SettingsDto>('put', '/settings', { ...v, ipRestriction: { enabled: v.ipRestriction.enabled, allowedIps: v.ipRestriction.allowedIps.map((i) => i.value) } }),
    onSuccess: ({ data, message }) => { toast.success(message); qc.setQueryData(['settings'], data); form.reset(toForm(data)); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const flow = levels?.join('>') ?? 'MANAGER>HR';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <PageHeader
          title="Settings"
          description="Company-wide rules. Every change is recorded in the audit log."
          actions={<Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>Save settings</Button>}
        />
        <div className="grid gap-5 lg:gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Leave approval</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <FormItem>
                <FormLabel>Who approves leave</FormLabel>
                <Select value={flow} onValueChange={(v) => form.setValue('approvalFlow.levels', v.split('>') as ('MANAGER' | 'HR')[], { shouldDirty: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGER>HR">Manager, then HR</SelectItem>
                    <SelectItem value="MANAGER">Manager only</SelectItem>
                    <SelectItem value="HR">HR only</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Balance is deducted only on the final approval. Without a manager, the manager step is skipped.</FormDescription>
              </FormItem>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Late policy</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <FormField control={form.control} name="latePolicy.enabled" render={({ field }) => <label className="flex items-center gap-3 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Deduct leave for repeated late arrivals</label>} />
              {lateOn && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="latePolicy.lateMarksPerDeduction" render={({ field }) => <FormItem><FormLabel>Late marks per day deducted</FormLabel><FormControl><Input type="number" min={1} max={31} {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="latePolicy.deductLeaveTypeCode" render={({ field }) => (
                    <FormItem><FormLabel>Deduct from</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{leaveTypes.data?.filter((t) => t.isPaid).map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <p className="text-[13px] text-muted-foreground sm:col-span-2">Applied on the 1st of each month for the previous month. People are warned with every late mark.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Check-in network</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <FormField control={form.control} name="ipRestriction.enabled" render={({ field }) => <label className="flex items-center gap-3 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Only allow check-in from office IPs</label>} />
              {ipOn && (
                <div className="grid gap-2">
                  {ips.fields.map((f, i) => (
                    <FormField key={f.id} control={form.control} name={`ipRestriction.allowedIps.${i}.value`} render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl><Input placeholder="103.48.16.* or 203.0.113.7" className="tabular" {...field} /></FormControl>
                          <Button type="button" variant="ghost" size="icon" onClick={() => ips.remove(i)} aria-label="Remove IP"><X /></Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ))}
                  <Button type="button" variant="outline" className="w-fit" onClick={() => ips.append({ value: '' })}><Plus /> Add IP</Button>
                  <p className="text-[13px] text-muted-foreground">End with * to allow a whole range. Behind a proxy, set TRUST_PROXY on the server so the real client IP is seen.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Time</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="timezone" render={({ field }) => <FormItem><FormLabel>Office timezone</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>IANA name, e.g. Asia/Dhaka. Times are stored in UTC.</FormDescription><FormMessage /></FormItem>} />
              <FormField control={form.control} name="autoCloseAfterMinutes" render={({ field }) => <FormItem><FormLabel>Close a forgotten day after</FormLabel><FormControl><Input type="number" min={30} max={720} {...field} /></FormControl><FormDescription>Minutes past shift end; the day is then flagged.</FormDescription><FormMessage /></FormItem>} />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
