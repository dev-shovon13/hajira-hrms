import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm mode="reset" />
    </Suspense>
  );
}
