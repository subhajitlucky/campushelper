import { Skeleton } from "@/components/ui/skeleton";

/**
 * Post-form loading state.
 *
 * A skeleton of the real form rather than a spinner: the dashed upload zone, one
 * row per field, and the submit button, in the same column and with the same
 * rhythm as `PostItemForm`, so nothing jumps when the form mounts.
 */
export default function PostLoading() {
  return (
    <main className="page-canvas min-h-[70vh]">
      <div
        className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14"
        role="status"
        aria-label="Loading the post form"
      >
        {/* PageHeader */}
        <div className="border-b border-border pb-8">
          <Skeleton className="h-9 w-52 sm:h-10 sm:w-64" />
          <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        </div>

        <div className="mt-10 space-y-8">
          {/* Photo — the dashed drop zone is the tallest element on the page */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>

          {/* Item status — one field, two options */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>

          {/* Title + Location */}
          {[0, 1].map((row) => (
            <div key={row} className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-4 w-1/3" />
          </div>

          {/* Category + Zone */}
          {[0, 1].map((row) => (
            <div key={row} className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}

          {/* Tags */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>

          {/* Submit */}
          <Skeleton className="h-11 w-full rounded-lg sm:w-44" />
        </div>

        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
