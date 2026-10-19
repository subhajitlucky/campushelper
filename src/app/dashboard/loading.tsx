import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCardGrid } from '@/components/ui/SkeletonCard';

const TAB_WIDTHS = ['w-20', 'w-24', 'w-32'];

/**
 * The dashboard's loading state: a skeleton of the real layout.
 *
 * The route used to show a centred spinner under two grey bars, which told the
 * user nothing about what was coming and then reflowed the whole page when the
 * data landed. Every block below has the geometry of the thing it replaces —
 * the identity row and hairline of the `PageHeader`, the four-figure stats
 * strip, the tab rule, and a `SkeletonCardGrid` at the item grid's column
 * counts — so nothing moves on hydration.
 *
 * Exported by name as well so the page can reuse it for its own client-side
 * auth/data wait (the route boundary only covers the server render).
 */
export function DashboardShellSkeleton() {
  return (
    <main className="page-canvas min-h-screen pb-24 pt-10 sm:pt-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-10">
          {/* PageHeader */}
          <div className="border-b border-border pb-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-4 sm:gap-5">
                  <Skeleton className="size-14 shrink-0 rounded-full" />
                  <Skeleton className="h-9 w-52 sm:h-10 sm:w-72" />
                </div>
                <Skeleton className="mt-3 h-4 w-full max-w-xl" />
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>

          {/* Stats strip — four numbers, no boxes */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>

          {/* Tab rule + first panel */}
          <div>
            <div className="flex gap-6 border-b border-border pb-3 sm:gap-8">
              {TAB_WIDTHS.map((width) => (
                <Skeleton key={width} className={`h-4 ${width}`} />
              ))}
            </div>

            <div className="pt-8">
              <Skeleton className="h-6 w-40" />
              <SkeletonCardGrid count={3} className="mt-6 gap-6" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DashboardLoading() {
  return <DashboardShellSkeleton />;
}
