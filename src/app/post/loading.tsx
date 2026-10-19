import { Skeleton } from "@/components/ui/skeleton";

/**
 * Post-form loading state.
 *
 * Mirrors the real composer's geometry — the header, the two-column split, the
 * four numbered blocks on the left and the sticky preview card on the right —
 * rather than a generic stack of bars. Nothing moves when the form mounts.
 */
export default function PostLoading() {
  return (
    <main className="page-canvas min-h-[70vh]">
      <div
        className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-20"
        role="status"
        aria-label="Loading the post form"
      >
        {/* PageHeader */}
        <div className="border-b border-border pb-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <Skeleton className="h-9 w-56 sm:h-10 sm:w-64" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        </div>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12">
          {/* Composer column */}
          <div className="min-w-0 space-y-7">
            {[0, 1, 2, 3].map((block) => (
              <div
                key={block}
                className={block === 0 ? "" : "border-t border-border-subtle pt-6"}
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full max-w-sm" />
                  </div>
                </div>

                <div className="mt-4 space-y-3 sm:pl-10">
                  {/* The photo block is one tall dashed zone; the others are rows. */}
                  {block === 0 ? (
                    <Skeleton className="h-64 w-full rounded-xl" />
                  ) : block === 1 ? (
                    <>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <Skeleton className="h-16 rounded-xl" />
                        <Skeleton className="h-16 rounded-xl" />
                      </div>
                      <Skeleton className="h-11 w-full rounded-lg" />
                    </>
                  ) : block === 2 ? (
                    <>
                      <Skeleton className="h-11 w-full rounded-lg" />
                      <div className="grid gap-6 sm:grid-cols-2">
                        <Skeleton className="h-11 w-full rounded-lg" />
                        <Skeleton className="h-11 w-full rounded-lg" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-32 w-full rounded-lg" />
                      <Skeleton className="h-11 w-full rounded-lg" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Preview rail — hidden below `lg`, exactly as it is on the page. */}
          <div className="hidden space-y-4 lg:block">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-10" />
            </div>
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>

        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
