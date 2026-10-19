import { Skeleton } from "@/components/ui/skeleton";

/**
 * Global loading fallback.
 *
 * Every redesigned page opens with a `PageHeader` (one 30/36px title, one line
 * of description, a hairline rule) followed by content. This mirrors that
 * geometry instead of centring a spinner, so a slow route still looks like the
 * page it is about to become. Pages with a more specific shape ship their own
 * `loading.tsx`.
 */
export default function GlobalLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14"
      role="status"
      aria-label="Loading page"
    >
      {/* PageHeader */}
      <div className="border-b border-border pb-8">
        <Skeleton className="h-9 w-56 sm:h-10 sm:w-72" />
        <Skeleton className="mt-4 h-5 w-full max-w-lg" />
      </div>

      <div className="mt-10 space-y-8">
        {[0, 1, 2].map((section) => (
          <div key={section} className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
