'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { loginSchema, type LoginInput, type SessionUser } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Label } from '@/components/ui/primitives';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PasswordInput } from '@/components/auth/password-input';
import { Notice } from '@/components/auth/notice';
import { ApiError, send } from '@/lib/api';

const DEMO = [
  { role: 'Super admin', email: 'admin@hajira.test', password: 'Admin@12345' },
  { role: 'HR', email: 'hr@hajira.test', password: 'Demo@12345' },
  { role: 'Manager', email: 'manager@hajira.test', password: 'Demo@12345' },
  { role: 'Employee', email: 'employee@hajira.test', password: 'Demo@12345' },
];
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [blocked, setBlocked] = React.useState<{ code: string; message: string; email: string } | null>(null);
  const [resending, setResending] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  async function onSubmit(values: LoginInput) {
    setBlocked(null);
    try {
      const { data, message } = await send<SessionUser>('post', '/auth/login', values);
      qc.setQueryData(['me'], data);
      toast.success(message);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setBlocked({ code: err.code ?? '', message: err.message, email: values.email });
      } else if (err instanceof ApiError && err.status === 401) {
        form.setError('password', { message: err.message });
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not sign in');
      }
    }
  }

  async function resend() {
    if (!blocked) return;
    setResending(true);
    try {
      const { message } = await send('post', '/auth/resend-verification', { email: blocked.email });
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the link');
    } finally {
      setResending(false);
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">Sign in</h1>
        <p className="text-muted-foreground">Use your work email. New here? <Link href="/register" className="font-medium text-leave-ink underline-offset-4 hover:underline">Create an account</Link></p>
      </div>

      {params.get('expired') && !blocked && <Notice tone="warning">Your session expired. Sign in again to pick up where you left off.</Notice>}
      {params.get('reset') && <Notice tone="success">Password updated. Sign in with your new password.</Notice>}

      {blocked && (
        <Notice tone={blocked.code === 'ACCOUNT_PENDING' ? 'info' : 'error'} title={blocked.code === 'ACCOUNT_PENDING' ? 'Almost there' : undefined}>
          <p>{blocked.message}</p>
          {blocked.code === 'EMAIL_NOT_VERIFIED' && (
            <button type="button" onClick={resend} disabled={resending} className="mt-1">
              {resending ? 'Sending…' : 'Send a new confirmation link'}
            </button>
          )}
        </Notice>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link href="/forgot-password" className="text-sm font-medium text-leave-ink underline-offset-4 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="remember"
            render={({ field }) => (
              <div className="flex items-center gap-2.5">
                <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                <Label htmlFor="remember" className="font-normal text-muted-foreground">
                  Keep me signed in for 7 days
                </Label>
              </div>
            )}
          />
          <Button type="submit" size="lg" loading={submitting} className="mt-1">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Form>

      {SHOW_DEMO && (
        <section className="grid gap-3 border-t pt-6" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="text-sm font-semibold">
            Demo accounts <span className="font-normal text-muted-foreground">· sample data, click to fill</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  form.setValue('email', d.email, { shouldValidate: true });
                  form.setValue('password', d.password, { shouldValidate: true });
                }}
                className="grid rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-ring/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-medium">{d.role}</span>
                <span className="truncate text-xs text-muted-foreground">{d.email}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
