import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NeedleIllustration } from '@/components/common';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-content-center justify-items-center gap-5 px-6 text-center">
      <NeedleIllustration className="h-20 w-44" />
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">This page dropped a stitch</h1>
        <p className="max-w-sm text-muted-foreground">The link may be old, or the page has moved. Head back to your dashboard.</p>
      </div>
      <Button asChild size="lg">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
