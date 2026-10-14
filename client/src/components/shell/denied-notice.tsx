'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const denied = params.get('denied');
  React.useEffect(() => {
    if (!denied) return;
    toast.warning('That page is for another role', { description: `You do not have access to ${denied}.` });
    router.replace(pathname);
  }, [denied, pathname, router]);
  return null;
}

/** Explains the redirect when middleware bounced someone off a role-gated page. */
export function DeniedNotice() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
