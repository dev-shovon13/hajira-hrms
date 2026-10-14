'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDropzone } from 'react-dropzone';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  changePasswordSchema,
  ROLE_LABELS,
  updateProfileSchema,
  type ChangePasswordInput,
  type SessionUser,
  type UpdateProfileInput,
  type UserDetail,
} from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from '@/components/ui/primitives';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Field, PageHeader } from '@/components/common';
import { PasswordInput, PasswordStrength } from '@/components/auth/password-input';
import { api, ApiError, errorMessage, get, send } from '@/lib/api';
import { fmtDate } from '@/lib/format';

export default function ProfilePage() {
  const q = useQuery({ queryKey: ['profile'], queryFn: () => get<UserDetail>('/users/me') });
  if (q.isLoading || !q.data) return <><PageHeader title="Profile" /><Skeleton className="h-[60vh] rounded-xl" /></>;
  const u = q.data;
  return (
    <>
      <PageHeader title="Profile" description="Your photo, contact details and password. HR manages your role, department and shift." />
      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid content-start gap-5 lg:gap-6">
          <Card>
            <CardContent className="grid justify-items-center gap-4 pt-6 text-center">
              <AvatarUpload user={u} />
              <div className="grid gap-1">
                <p className="text-lg font-semibold">{u.name}</p>
                <p className="text-sm text-muted-foreground">{u.designation?.title} · {u.department?.name}</p>
              </div>
              <dl className="grid w-full grid-cols-2 gap-4 border-t pt-4 text-left">
                <Field label="Employee code"><span className="tabular">{u.employeeCode ?? '—'}</span></Field>
                <Field label="Role">{ROLE_LABELS[u.role]}</Field>
                <Field label="Reports to">{u.manager?.name ?? '—'}</Field>
                <Field label="Joined">{u.joinDate ? fmtDate(u.joinDate) : '—'}</Field>
                <Field label="Shift" className="col-span-2">{u.currentShift ? `${u.currentShift.name} · ${u.currentShift.startTime}–${u.currentShift.endTime}` : '—'}</Field>
              </dl>
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-5 lg:gap-6">
          <PersonalInfo user={u} />
          <ChangePassword />
        </div>
      </div>
    </>
  );
}

function AvatarUpload({ user }: { user: UserDetail }) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post('/users/me/avatar', body);
      return res.data as { data: SessionUser; message: string };
    },
    onSuccess: ({ data, message }) => {
      toast.success(message);
      qc.setQueryData(['me'], data);
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const dz = useDropzone({
    multiple: false,
    maxSize: 5 * 1024 * 1024,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    onDropAccepted: ([f]) => upload.mutate(f),
    onDropRejected: (r) => toast.error(r[0]?.errors[0]?.code === 'file-too-large' ? 'Photos must be 5 MB or smaller' : 'Use a JPG, PNG or WebP photo'),
  });
  return (
    <div {...dz.getRootProps({ className: 'group relative cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4' })}>
      <input {...dz.getInputProps({ 'aria-label': 'Change profile photo' })} />
      <Avatar name={user.name} src={user.avatarUrl} size="xl" className={dz.isDragActive ? 'ring-4 ring-ring' : ''} />
      <span className="absolute inset-0 grid place-items-center rounded-full bg-[#0b0e22]/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {upload.isPending ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
      </span>
      <span className="sr-only">Drop a photo or click to choose one</span>
    </div>
  );
}

function PersonalInfo({ user }: { user: UserDetail }) {
  const qc = useQueryClient();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name, phone: user.phone ?? '', address: user.address ?? '', emergencyContact: user.emergencyContact ?? '', dateOfBirth: user.dateOfBirth ?? '' },
  });
  const save = useMutation({
    mutationFn: (v: UpdateProfileInput) => send<SessionUser>('patch', '/users/me', v),
    onSuccess: ({ data, message }) => { toast.success(message); qc.setQueryData(['me'], data); void qc.invalidateQueries({ queryKey: ['profile'] }); form.reset(form.getValues()); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Personal information</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Full name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormItem><FormLabel>Email</FormLabel><Input value={user.email} disabled readOnly /></FormItem>
              <FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input type="tel" autoComplete="tel" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => <FormItem><FormLabel>Date of birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="address" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input autoComplete="street-address" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="emergencyContact" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Emergency contact</FormLabel><FormControl><Input placeholder="Name · relationship · phone" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>Save details</Button></div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ChangePassword() {
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), mode: 'onTouched', defaultValues: { currentPassword: '', password: '', confirmPassword: '' } });
  const password = useWatch({ control: form.control, name: 'password' });
  const save = useMutation({
    mutationFn: (v: ChangePasswordInput) => send('post', '/auth/change-password', v),
    onSuccess: ({ message }) => { toast.success(message); form.reset(); },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors) for (const [f, m] of Object.entries(e.fieldErrors)) form.setError(f as keyof ChangePasswordInput, { message: m[0] });
      else toast.error(errorMessage(e));
    },
  });
  return (
    <Card id="password" className="scroll-mt-24">
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
            <FormField control={form.control} name="currentPassword" render={({ field }) => <FormItem><FormLabel>Current password</FormLabel><FormControl><PasswordInput autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>New password</FormLabel><FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm new password</FormLabel><FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <PasswordStrength value={password} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">Other devices are signed out when you change it.</p>
              <Button type="submit" loading={save.isPending}>Update password</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
