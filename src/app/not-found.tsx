import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * 404.
 *
 * Centred, one column, one sentence, one action — no illustration, no box
 * (brief §4.9). The wordmark in the navbar is what identifies the product here;
 * this page only has to explain and offer a way back.
 */
export default function NotFound() {
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
