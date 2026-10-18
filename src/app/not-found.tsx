import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <SearchX className="w-24 h-24 text-muted-foreground/70 mx-auto mb-6" />
          <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-foreground/85 mb-2">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/">Go Home</Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="w-full"
          >
            <Link href="/search">Search Items</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
