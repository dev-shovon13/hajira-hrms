import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MyAttendance } from '@/features/attendance/my-attendance';

export const metadata: Metadata = { title: 'My attendance' };

export default function AttendancePage() {
  return (
    <Suspense>
      <MyAttendance />
    </Suspense>
  );
}
