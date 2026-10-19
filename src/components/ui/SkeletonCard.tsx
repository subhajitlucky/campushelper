import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

interface SkeletonCardProps {
  className?: string;
}

/**
 * SkeletonCard
 *
 * The loading state for an ItemCard, with the *same* geometry as the real card:
 * a 4:3 image block, a two-line title slot, and a meta row. Because the sizes
 * match, nothing on the page moves when the data arrives — which is the whole
 * point of a skeleton over a spinner.
 *
 * Shimmer comes from the shared `Skeleton` primitive, so it respects
 * prefers-reduced-motion in one place.
 */
export default function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card",
        className
      )}
      aria-hidden="true"
    >
      {/* Image block — 4:3, same as ItemCard */}
      <Skeleton className="aspect-[4/3] w-full rounded-none" />

      {/* Body — title row + meta row, same padding as ItemCard */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

interface SkeletonCardGridProps {
  count?: number;
  className?: string;
}

/**
 * A responsive grid of SkeletonCards, using the same column counts as the item
 * grids (1 / 2 / 3 / 4).
 */
export function SkeletonCardGrid({ count = 8, className }: SkeletonCardGridProps) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4", className)}
      role="status"
      aria-label="Loading items"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
