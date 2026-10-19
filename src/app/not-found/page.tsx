import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * The `/not-found` route.
 *
 * Same shape as the app-level 404 (brief §4.9): centred, `max-w-md`, one
 * sentence, one action, no box. Kept deliberately identical so a mistyped URL
 * and an unmatched route are indistinguishable to the user.
 */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Page not found
        </h1>

        <p className="mt-3 text-base text-foreground/85">
          That link does not lead anywhere — the page may have been moved or removed.
        </p>

        <Button asChild size="lg" className="mt-8">
          <Link href="/">Go to the homepage</Link>
        </Button>
      </div>
    </main>
  );
}
