'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { format, parseISO, subDays } from 'date-fns';
import { CalendarDays, FileUp, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { applyLeaveSchema, type ApplyLeaveInput, type LeaveBalanceDto, type LeavePreviewDto } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Label, Popover, PopoverContent, PopoverTrigger, RadioGroup, RadioGroupItem, Switch, Textarea } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Sheet, SheetContent } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Notice } from '@/components/auth/notice';
import { useLeaveTypes } from '@/hooks/use-options';
import { useDebounced } from '@/hooks/use-debounced';
import { api, ApiError, errorMessage, send } from '@/lib/api';
import { DEFAULT_TZ, fmtDay, fmtDays, fmtRange, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ApplyLeaveSheet({
  open,
  onOpenChange,
  balances,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  balances: LeaveBalanceDto[] | undefined;
}) {
  const qc = useQueryClient();
  const types = useLeaveTypes();
  const today = todayIn(DEFAULT_TZ);
  const [upload, setUpload] = React.useState<{ name: string; busy: boolean } | null>(null);

  const form = useForm<ApplyLeaveInput>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: { leaveTypeId: '', startDate: '', endDate: '', isHalfDay: false, reason: '', attachmentUrl: '' },
  });
  const [leaveTypeId, startDate, endDate, isHalfDay, halfDaySession] = useWatch({
    control: form.control,
    name: ['leaveTypeId', 'startDate', 'endDate', 'isHalfDay', 'halfDaySession'],
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ leaveTypeId: '', startDate: '', endDate: '', isHalfDay: false, reason: '', attachmentUrl: '' });
      setUpload(null);
    }
  }, [open, form]);

  const type = types.data?.find((t) => t.id === leaveTypeId);
  const singleDay = Boolean(startDate) && startDate === endDate;
  const previewInput = useDebounced(
    leaveTypeId && startDate && endDate ? { leaveTypeId, startDate, endDate, isHalfDay: singleDay && isHalfDay } : null,
    200,
  );
  const preview = useQuery({
    queryKey: ['leave', 'preview', previewInput],
    queryFn: async () => (await send<LeavePreviewDto>('post', '/leave/requests/preview', previewInput)).data,
    enabled: Boolean(previewInput),
    placeholderData: (prev) => prev,
  });

  const apply = useMutation({
    mutationFn: (v: ApplyLeaveInput) => send('post', '/leave/requests', v),
    onSuccess: ({ message }) => {
      toast.success(message);
      for (const k of [['leave'], ['dashboard'], ['counts'], ['calendar']]) void qc.invalidateQueries({ queryKey: k });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [f, m] of Object.entries(err.fieldErrors)) form.setError(f as keyof ApplyLeaveInput, { message: m[0] });
      }
      toast.error(errorMessage(err));
    },
  });

  const dropzone = useDropzone({
    multiple: false,
    maxSize: 5 * 1024 * 1024,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    onDropRejected: (r) => toast.error(r[0]?.errors[0]?.code === 'file-too-large' ? 'Files must be 5 MB or smaller' : 'Use a PDF, JPG, PNG or WebP file'),
    onDropAccepted: async ([file]) => {
      setUpload({ name: file.name, busy: true });
      try {
        const body = new FormData();
        body.append('file', file);
        const res = await api.post('/leave/attachments', body);
        form.setValue('attachmentUrl', res.data.data.url, { shouldValidate: true });
        setUpload({ name: file.name, busy: false });
      } catch (err) {
        setUpload(null);
        toast.error(errorMessage(err));
      }
    },
  });

  const balanceOf = (id: string) => balances?.find((b) => b.leaveType.id === id);
  const p = preview.data;
  const blocked = Boolean(p?.problems.length);
  const range = startDate ? { from: parseISO(startDate), to: endDate ? parseISO(endDate) : undefined } : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(100%,30rem)] p-0" aria-describedby={undefined}>
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold">Apply for leave</h2>
          <p className="text-sm text-muted-foreground">Weekends and holidays are not counted.</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => apply.mutate({ ...v, isHalfDay: singleDay && v.isHalfDay }))} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="grid flex-1 content-start gap-5 overflow-y-auto px-6 py-5">
              <FormField
                control={form.control}
                name="leaveTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a leave type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {types.data?.map((t) => {
                          const b = balanceOf(t.id);
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                              {t.isPaid && b ? ` · ${b.available} left` : !t.isPaid ? ' · unpaid' : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={() => (
                  <FormItem>
                    <FormLabel>Dates</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button type="button" variant="outline" className={cn('h-10 justify-start font-normal', !startDate && 'text-muted-foreground')}>
                            <CalendarDays className="text-muted-foreground" />
                            {startDate ? fmtRange(startDate, endDate || startDate) : 'Pick the first and last day'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-3">
                        <Calendar
                          mode="range"
                          numberOfMonths={1}
                          selected={range}
                          defaultMonth={range?.from ?? parseISO(today)}
                          disabled={{ before: subDays(parseISO(today), 30) }}
                          onSelect={(r) => {
                            form.setValue('startDate', r?.from ? format(r.from, 'yyyy-MM-dd') : '', { shouldValidate: true });
                            form.setValue('endDate', r?.to ? format(r.to, 'yyyy-MM-dd') : r?.from ? format(r.from, 'yyyy-MM-dd') : '', { shouldValidate: true });
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                    {form.formState.errors.endDate && <p className="text-[13px] font-medium text-absent-ink">{form.formState.errors.endDate.message}</p>}
                  </FormItem>
                )}
              />

              {singleDay && type?.allowHalfDay && (
                <div className="grid gap-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="half-day">Half day</Label>
                    <Switch
                      id="half-day"
                      checked={isHalfDay}
                      onCheckedChange={(v) => {
                        form.setValue('isHalfDay', v);
                        form.setValue('halfDaySession', v ? (halfDaySession ?? 'FIRST_HALF') : undefined);
                      }}
                    />
                  </div>
                  {isHalfDay && (
                    <RadioGroup
                      value={halfDaySession ?? 'FIRST_HALF'}
                      onValueChange={(v) => form.setValue('halfDaySession', v as 'FIRST_HALF' | 'SECOND_HALF')}
                      className="grid-cols-2"
                      aria-label="Which half"
                    >
                      {[
                        ['FIRST_HALF', 'Morning off'],
                        ['SECOND_HALF', 'Afternoon off'],
                      ].map(([v, l]) => (
                        <label key={v} className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value={v} /> {l}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              )}

              {/* Live count: the employee sees exactly what will be deducted before submitting. */}
              {previewInput && p && (
                <div className={cn('grid gap-3 rounded-lg p-4 transition-opacity', blocked ? 'bg-absent-wash' : 'bg-leave-wash', preview.isFetching && 'opacity-70')} aria-live="polite">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={cn('text-sm', blocked ? 'text-absent-ink' : 'text-leave-ink')}>
                      <span className="tabular text-figure-sm font-semibold">{p.days}</span> working {p.days === 1 ? 'day' : 'days'}
                    </p>
                    {p.balance && (
                      <p className="tabular text-right text-[13px] text-muted-foreground">
                        {p.balance.available} left now
                        <br />
                        <strong className="font-semibold text-foreground">{p.balance.afterApproval}</strong> after approval
                      </p>
                    )}
                    {!p.isPaid && <p className="text-[13px] text-muted-foreground">Unpaid: no balance used</p>}
                  </div>
                  {p.workingDates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Days counted">
                      {p.workingDates.slice(0, 14).map((d) => (
                        <span key={d} className="tabular rounded-md bg-card px-2 py-1 text-xs font-medium">
                          {fmtDay(d)}
                        </span>
                      ))}
                      {p.workingDates.length > 14 && <span className="text-xs text-muted-foreground">+{p.workingDates.length - 14} more</span>}
                    </div>
                  )}
                  {p.excluded.length > 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      Not counted: {p.excluded.slice(0, 4).map((e) => `${fmtDay(e.date)} (${e.reason === 'HOLIDAY' ? e.label : 'weekly off'})`).join(', ')}
                      {p.excluded.length > 4 && `, +${p.excluded.length - 4} more`}
                    </p>
                  )}
                  {p.problems.map((msg) => (
                    <p key={msg} className="text-sm font-medium text-absent-ink">
                      {msg}
                    </p>
                  ))}
                </div>
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea placeholder="A short note for your approver" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="attachmentUrl"
                render={() => (
                  <FormItem>
                    <FormLabel>
                      Attachment <span className="font-normal text-muted-foreground">{p?.attachmentRequired ? '(required for this request)' : '(optional)'}</span>
                    </FormLabel>
                    {upload ? (
                      <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                        {upload.busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Paperclip className="size-4 text-muted-foreground" />}
                        <span className="min-w-0 flex-1 truncate">{upload.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove attachment"
                          onClick={() => {
                            setUpload(null);
                            form.setValue('attachmentUrl', '');
                          }}
                        >
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <div
                        {...dropzone.getRootProps({
                          className: cn(
                            'grid cursor-pointer justify-items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                            dropzone.isDragActive && 'border-ring bg-accent',
                            p?.attachmentRequired && 'border-late',
                          ),
                        })}
                      >
                        <input {...dropzone.getInputProps({ 'aria-label': 'Upload attachment' })} />
                        <FileUp className="size-5 text-muted-foreground" aria-hidden />
                        <p className="text-sm">
                          <span className="font-medium text-leave-ink">Choose a file</span> or drop it here
                        </p>
                        <p className="text-xs text-muted-foreground">PDF, JPG, PNG or WebP · up to 5 MB</p>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {type && !type.isPaid && <Notice tone="info">Unpaid leave never blocks on balance, but it still needs approval.</Notice>}
            </div>

            <div className="flex gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={apply.isPending} disabled={blocked || upload?.busy}>
                {p && !blocked ? `Request ${fmtDays(p.days)}` : 'Send request'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
