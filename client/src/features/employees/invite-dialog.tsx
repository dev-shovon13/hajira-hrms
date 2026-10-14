'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inviteUserSchema, ROLE_LABELS, ROLES, type InviteUserInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useDepartments, useDesignations, usePeople, useShifts } from '@/hooks/use-options';
import { useRole } from '@/hooks/use-session';
import { ApiError, errorMessage, send } from '@/lib/api';

const NONE = '__none__';

export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { name: '', email: '', phone: '', role: 'EMPLOYEE', departmentId: '', designationId: '', managerId: null, shiftId: null },
  });
  const departmentId = useWatch({ control: form.control, name: 'departmentId' });
  const departments = useDepartments();
  const designations = useDesignations(departmentId || undefined);
  const managers = usePeople(['MANAGER', 'HR', 'ADMIN'], open);
  const shifts = useShifts();

  React.useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  const invite = useMutation({
    mutationFn: (v: InviteUserInput) => send('post', '/users/invite', v),
    onSuccess: ({ message }) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') form.setError('email', { message: err.message });
      else toast.error(errorMessage(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Invite an employee</DialogTitle>
          <DialogDescription>They get an email with a link to set their password. The account is active as soon as they do.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => invite.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Work email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Mobile <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input type="tel" placeholder="01712345678" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ROLES.filter((r) => r !== 'ADMIN' || isAdmin).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('designationId', ''); }}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>{departments.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="designationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!departmentId}>
                    <FormControl><SelectTrigger><SelectValue placeholder={departmentId ? 'Choose' : 'Pick a department first'} /></SelectTrigger></FormControl>
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
                      {managers.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="shiftId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Department default</SelectItem>
                      {shifts.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.startTime}–{s.endTime}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={invite.isPending}>Send invitation</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
