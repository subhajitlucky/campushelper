import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /item/[id].
 *
 * A skeleton of the real page — page title, meta row, 4:3 hero, and the sticky
 * rail's blocks — rather than a centred spinner, so nothing moves when the item
 * arrives (brief §4.1, §4.9).
 */
export default function LoadingItemDetail() {
  return (
    <div className="page-canvas" role="status" aria-label="Loading item">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Back link */}
        <Skeleton className="h-4 w-14" />

        {/* PageHeader: title, then the single meta row */}
        <div className="mt-6 border-b border-border pb-8">
          <Skeleton className="h-9 w-3/4 max-w-xl sm:h-10" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <div className="mt-10 grid gap-x-12 gap-y-12 lg:grid-cols-3">
          {/* Lead: hero, then the description */}
          <div className="space-y-8 lg:col-start-1 lg:row-start-1">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <div className="max-w-[65ch] space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>

          {/* Rail: owner, details, actions */}
          <div className="space-y-10 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div>
              <Skeleton className="h-3 w-20" />
              <div className="mt-3 flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
            </div>

            <div>
              <Skeleton className="h-3 w-16" />
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>

          {/* Discussion */}
          <div className="space-y-12 lg:col-start-1 lg:row-start-2">
            <div>
              <Skeleton className="h-6 w-36" />
              <div className="mt-6 space-y-6">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <span className="sr-only">Loading item details…</span>
      </div>
    </div>
  );
}
