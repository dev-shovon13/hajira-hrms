import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MyLeave } from '@/features/leave/my-leave';

export const metadata: Metadata = { title: 'Leave' };

export default function LeavePage() {
  return (
    <Suspense>
      <MyLeave />
    </Suspense>
  );
}
