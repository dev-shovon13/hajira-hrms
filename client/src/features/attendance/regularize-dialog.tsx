'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { regularizationSchema, type RegularizationInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ApiError, errorMessage, send } from '@/lib/api';
import { fmtDateLong } from '@/lib/format';

export function RegularizeDialog({
  open,
  onOpenChange,
  date,
  maxDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date?: string;
  maxDate: string;
}) {
  const qc = useQueryClient();
  const form = useForm<RegularizationInput>({
    resolver: zodResolver(regularizationSchema),
    defaultValues: { date: date ?? maxDate, checkIn: '', checkOut: '', reason: '' },
  });
  React.useEffect(() => {
    if (open) form.reset({ date: date ?? maxDate, checkIn: '', checkOut: '', reason: '' });
  }, [open, date, maxDate, form]);

  const create = useMutation({
    mutationFn: (v: RegularizationInput) => send('post', '/regularizations', v),
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['regularizations'] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [f, m] of Object.entries(err.fieldErrors)) form.setError(f as keyof RegularizationInput, { message: m[0] });
      } else toast.error(errorMessage(err));
    },
  });

  const picked = form.watch('date');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a correction</DialogTitle>
          <DialogDescription>
            Forgot to check in or out, or the time is wrong? Your manager reviews the change and it is logged in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-5" noValidate>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" max={maxDate} {...field} />
                  </FormControl>
                  {picked && /^\d{4}-\d{2}-\d{2}$/.test(picked) && <FormDescription>{fmtDateLong(picked)}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="checkIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correct check-in</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correct check-out</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened?</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Stayed for the client call and forgot to check out." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending}>
                Send for approval
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
