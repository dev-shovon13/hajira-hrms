'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resetPasswordSchema, type ResetPasswordInput, type SessionUser } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PasswordInput, PasswordStrength } from './password-input';
import { Notice } from './notice';
import { ApiError, send } from '@/lib/api';

/** Shared by "reset password" and "accept invite": both set a password from an emailed token. */
export function SetPasswordForm({ mode }: { mode: 'reset' | 'invite' }) {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const token = params.get('token') ?? '';
  const [linkError, setLinkError] = React.useState<string | null>(token ? null : 'This link is missing its token.');

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { token, password: '', confirmPassword: '' },
  });
  const password = useWatch({ control: form.control, name: 'password' });

  async function onSubmit(values: ResetPasswordInput) {
    try {
      if (mode === 'reset') {
        await send('post', '/auth/reset-password', values);
        router.replace('/login?reset=1');
      } else {
        const { data, message } = await send<SessionUser>('post', '/auth/accept-invite', values);
        qc.setQueryData(['me'], data);
        toast.success(message);
        router.replace('/dashboard');
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'INVALID_LINK' || err.code === 'LINK_EXPIRED')) setLinkError(err.message);
      else toast.error(err instanceof Error ? err.message : 'Could not save the password');
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">
          {mode === 'reset' ? 'Choose a new password' : 'Set up your account'}
        </h1>
        <p className="text-muted-foreground">
          {mode === 'reset'
            ? 'Every device signed in to your account will be signed out.'
            : 'Choose a password to activate your account. You can check in right after.'}
        </p>
      </div>

      {linkError ? (
        <div className="grid gap-5">
          <Notice tone="error">{linkError}</Notice>
          <Button asChild variant="outline" size="lg">
            <Link href={mode === 'reset' ? '/forgot-password' : '/login'}>
              {mode === 'reset' ? 'Request a new link' : 'Go to sign in'}
            </Link>
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" autoFocus {...field} />
                  </FormControl>
                  <PasswordStrength value={password} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
              {mode === 'reset' ? 'Update password' : 'Activate account'}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
