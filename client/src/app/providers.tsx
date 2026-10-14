'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';

const ReactQueryDevtools = React.lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
);

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => {
          // Never retry what the server deliberately refused.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeClient);
  // Devtools mount after hydration so their markup never differs from the server's.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>{children}</TooltipProvider>
        </MotionConfig>
        <Toaster
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: '!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-float !font-sans',
              description: '!text-muted-foreground',
              success: '[&_[data-icon]]:!text-present',
              error: '[&_[data-icon]]:!text-absent',
              warning: '[&_[data-icon]]:!text-late',
            },
          }}
        />
        {process.env.NODE_ENV === 'development' && mounted && (
          <React.Suspense>
            <ReactQueryDevtools buttonPosition="bottom-right" />
          </React.Suspense>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
