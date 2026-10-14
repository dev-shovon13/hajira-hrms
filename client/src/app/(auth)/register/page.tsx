'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { registerSchema, type RegisterInput } from '@hajira/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/menu';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PasswordInput, PasswordStrength } from '@/components/auth/password-input';
import { ApiError, get, send } from '@/lib/api';

type Option = { id: string; name?: string; title?: string; departmentId?: string | null };

export default function RegisterPage() {
  const [doneFor, setDoneFor] = React.useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', departmentId: '', designationId: '' },
  });
  const departmentId = useWatch({ control: form.control, name: 'departmentId' });
  const password = useWatch({ control: form.control, name: 'password' });

  const departments = useQuery({
    queryKey: ['departments', 'options'],
    queryFn: () => get<Option[]>('/departments/options'),
    staleTime: 10 * 60_000,
  });
  const designations = useQuery({
    queryKey: ['designations', 'options', departmentId],
    queryFn: () => get<Option[]>('/designations/options', { params: { departmentId } }),
    enabled: Boolean(departmentId),
    staleTime: 10 * 60_000,
  });

  async function onSubmit(values: RegisterInput) {
    try {
      const { data } = await send<{ email: string }>('post', '/auth/register', values);
      setDoneFor(data.email);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, msgs] of Object.entries(err.fieldErrors)) {
          form.setError(field as keyof RegisterInput, { message: msgs[0] });
        }
      } else if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        form.setError('email', { message: err.message });
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not create the account');
      }
    }
  }

  if (doneFor) {
    return (
      <div className="grid gap-6">
        <span className="flex size-12 items-center justify-center rounded-xl bg-present-wash text-present-ink">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <div className="grid gap-2">
          <h1 className="text-[1.75rem] font-semibold leading-tight">Check your email</h1>
          <p className="leading-relaxed text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{doneFor}</strong>. After you confirm, HR
            reviews your account. We will email you when it is approved.
          </p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">Create your account</h1>
        <p className="text-muted-foreground">
          HR approves new accounts. Already have one?{' '}
          <Link href="/login" className="font-medium text-leave-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Nusrat Jahan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="01712345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue('designationId', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger onBlur={field.onBlur}>
                        <SelectValue placeholder={departments.isLoading ? 'Loading…' : 'Choose'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.data?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="designationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!departmentId}>
                    <FormControl>
                      <SelectTrigger onBlur={field.onBlur}>
                        <SelectValue placeholder={departmentId ? 'Choose' : 'Pick a department first'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {designations.data?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
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
                <FormDescription className="sr-only">Type the same password again</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" loading={submitting} className="mt-1">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
