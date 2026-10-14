'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { send } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  async function onSubmit(values: ForgotPasswordInput) {
    try {
      await send('post', '/auth/forgot-password', values);
      setSentTo(values.email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the link');
    }
  }

  return (
    <div className="grid gap-8">
      <Link href="/login" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>

      {sentTo ? (
        <div className="grid gap-6">
          <span className="flex size-12 items-center justify-center rounded-xl bg-leave-wash text-leave-ink">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <div className="grid gap-2">
            <h1 className="text-[1.75rem] font-semibold leading-tight">Check your inbox</h1>
            <p className="leading-relaxed text-muted-foreground">
              If an account exists for <strong className="text-foreground">{sentTo}</strong>, a reset link is on its way.
              It works once and expires in 15 minutes.
            </p>
          </div>
          <Button variant="outline" size="lg" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">Reset your password</h1>
            <p className="text-muted-foreground">Enter your work email and we will send you a link to choose a new one.</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" inputMode="email" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
                Send reset link
              </Button>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}
