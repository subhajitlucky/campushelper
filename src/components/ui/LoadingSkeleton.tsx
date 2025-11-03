/**
 * LoadingSkeleton Component
 *
 * Reusable skeleton loading states for consistent UI.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

interface ItemCardSkeletonProps {
  showImage?: boolean;
}

export function ItemCardSkeleton({ showImage = true }: ItemCardSkeletonProps) {
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {showImage && (
        <Skeleton className="aspect-video w-full" />
      )}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-16 ml-2" />
        </div>
        <Skeleton className="h-4 w-1/4 mb-4" />
        <Skeleton className="h-16 w-full mb-4" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

interface ItemListSkeletonProps {
  count?: number;
  showImage?: boolean;
}

export function ItemListSkeleton({ count = 6, showImage = true }: ItemListSkeletonProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <ItemCardSkeleton key={i} showImage={showImage} />
      ))}
    </div>
  );
}

interface ListItemSkeletonProps {
  count?: number;
}

export function ListItemSkeleton({ count = 3 }: ListItemSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-2/3 mb-2" />
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
