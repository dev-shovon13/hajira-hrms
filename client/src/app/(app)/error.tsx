'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { NeedleIllustration } from '@/components/common';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="grid justify-items-center gap-4 px-6 py-16 text-center">
      <NeedleIllustration tone="absent" />
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold">Something broke on this page</h1>
        <p className="max-w-md text-sm text-muted-foreground">The rest of the app still works. Try again, and if it keeps happening, tell your admin{error.digest ? ` (reference ${error.digest})` : ''}.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
