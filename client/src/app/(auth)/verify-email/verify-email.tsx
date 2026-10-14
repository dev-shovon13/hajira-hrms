'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { send } from '@/lib/api';

type State = { kind: 'loading' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string };

export function VerifyEmail() {
  const token = useSearchParams().get('token');
  const [state, setState] = React.useState<State>({ kind: 'loading' });
  const ran = React.useRef(false);

  React.useEffect(() => {
    // Tokens are single-use: never post twice (React strict mode runs effects twice in dev).
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState({ kind: 'error', message: 'This link is missing its token.' });
      return;
    }
    send('post', '/auth/verify-email', { token })
      .then(({ message }) => setState({ kind: 'ok', message }))
      .catch((err: Error) => setState({ kind: 'error', message: err.message }));
  }, [token]);

  return (
    <div className="grid gap-6" aria-live="polite">
      {state.kind === 'loading' && (
        <>
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
          <h1 className="text-[1.75rem] font-semibold leading-tight">Confirming your email…</h1>
        </>
      )}
      {state.kind === 'ok' && (
        <>
          <span className="flex size-12 items-center justify-center rounded-xl bg-present-wash text-present-ink">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div className="grid gap-2">
            <h1 className="text-[1.75rem] font-semibold leading-tight">Email confirmed</h1>
            <p className="leading-relaxed text-muted-foreground">{state.message}</p>
          </div>
          <Button asChild size="lg">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <span className="flex size-12 items-center justify-center rounded-xl bg-absent-wash text-absent-ink">
            <XCircle className="size-6" aria-hidden />
          </span>
          <div className="grid gap-2">
            <h1 className="text-[1.75rem] font-semibold leading-tight">We could not confirm this link</h1>
            <p className="leading-relaxed text-muted-foreground">
              {state.message} Sign in and we will offer to send a fresh link.
            </p>
          </div>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </>
      )}
    </div>
  );
}
