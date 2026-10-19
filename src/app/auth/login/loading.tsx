import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sign-in loading state: the wordmark, the card, and its two fields, at the same
 * sizes as the real page so the form does not shift when it mounts.
 */
export default function LoginLoading() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-background px-4 py-12">
      <div
        className="w-full max-w-sm"
        role="status"
        aria-label="Loading the sign-in form"
      >
        <div className="mb-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-full" />
        </div>

        <div className="card-surface p-6 sm:p-8">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-2 h-4 w-44" />

          <div className="mt-6 space-y-5">
            {[0, 1].map((row) => (
              <div key={row} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>

          <Skeleton className="mt-6 h-11 w-full rounded-lg" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-4 h-11 w-full rounded-lg" />
        </div>

        <Skeleton className="mt-6 h-4 w-40" />

        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
