'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route error boundary.
 *
 * Centred, `max-w-md`, one sentence, one action (brief §4.9): the action is the
 * one that can actually help, which is retrying the render. The raw message is
 * development-only and separated by a rule rather than boxed.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error only in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error);
    }
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Something went wrong
        </h1>

        <p className="mt-3 text-base text-foreground/85">
          This page could not be loaded. Trying again usually fixes it.
        </p>

        <Button size="lg" className="mt-8" onClick={reset}>
          <RefreshCw className="mr-2 size-4" aria-hidden="true" />
          Try again
        </Button>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-10 border-t border-border pt-6 text-left">
            <p className="text-sm font-medium text-foreground">Error details (development only)</p>
            <p className="mt-2 break-all font-mono text-sm text-muted-foreground">{error.message}</p>
            {error.digest && (
              <p className="mt-1 text-sm text-muted-foreground">Digest: {error.digest}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
