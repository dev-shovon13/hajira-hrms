import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata: Metadata = { title: 'Accept invitation' };

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <SetPasswordForm mode="invite" />
    </Suspense>
  );
}
