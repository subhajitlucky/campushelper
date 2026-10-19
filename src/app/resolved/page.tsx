'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CircleCheck } from 'lucide-react';

import ItemListShell, {
  type ListItem,
  type ListSelectConfig,
  type ListTextConfig,
} from '@/components/ItemListShell';
import { Button } from '@/components/ui/button';
import ItemCard from '@/components/ui/ItemCard';

type ResolvedItem = ListItem;

interface ResolvedFilters {
  itemType: string;
  location: string;
}

const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'LOST', label: 'Lost items' },
  { value: 'FOUND', label: 'Found items' },
] as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * How long the reunion took, in the words a person would use. Sub-day returns
 * are the common case on a campus board, and "returned in 0 days" is not a
 * sentence.
 */
function returnedInLabel(item: ResolvedItem): string | null {
  if (!item.resolvedAt) return null;

  const start = new Date(item.createdAt).getTime();
  const end = new Date(item.resolvedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  const hours = (end - start) / (MS_PER_DAY / 24);
  if (hours < 24) return 'Returned within a day';

  const days = Math.round(hours / 24);
  return days === 1 ? 'Returned in 1 day' : `Returned in ${days} days`;
}

/**
 * Resolved — the success stories, and the only list that reports how long a
 * return took.
 *
 * Two long-standing bugs are fixed here rather than carried over: the page
 * count now comes from the `pagination` envelope instead of a top-level
 * `total` that never existed, and the filters are actually sent to the API
 * instead of only updating local state.
 */
export default function ResolvedPage() {
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<ResolvedFilters>({
    itemType: '',
    location: '',
  });

  const limit = 12;

  const fetchResolvedItems = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          status: 'RESOLVED',
          ...(filters.itemType && { itemType: filters.itemType }),
          ...(filters.location && { location: filters.location }),
        });

        const response = await fetch(`/api/items?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setItems(data.items || []);
        // `pagination`, not a top-level `total` — the API has never returned
        // the latter, and reading it left totalPages at NaN.
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotal(data.pagination?.total ?? 0);
      } catch {
        setError('Failed to load resolved items. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [filters, limit]
  );

  useEffect(() => {
    fetchResolvedItems(currentPage);
  }, [currentPage, fetchResolvedItems]);

  const handleFilterChange = (key: keyof ResolvedFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ itemType: '', location: '' });
    setCurrentPage(1);
  };

  const selects: ListSelectConfig[] = [
    {
      id: 'filter-item-type',
      label: 'Item type',
      value: filters.itemType,
      options: ITEM_TYPE_OPTIONS,
      onChange: (value) => handleFilterChange('itemType', value),
      className: 'sm:w-40',
    },
  ];

  const texts: ListTextConfig[] = [
    {
      id: 'filter-location',
      label: 'Location',
      value: filters.location,
      placeholder: 'Filter by location…',
      onChange: (value) => handleFilterChange('location', value),
      className: 'sm:w-56',
    },
  ];

  const activeFilterCount =
    (filters.itemType ? 1 : 0) + (filters.location ? 1 : 0);

  return (
    <ItemListShell
      title="Resolved"
      description="Every report here made it back to its owner, and each card shows how long the reunion took."
      noun={{ singular: 'resolved item', plural: 'resolved items' }}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/search">Browse active listings</Link>
          </Button>
          <Button asChild>
            <Link href="/post">Report an item</Link>
          </Button>
        </>
      }
      items={items}
      total={total}
      loading={loading}
      error={error}
      onRetry={() => fetchResolvedItems(currentPage)}
      texts={texts}
      selects={selects}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      renderItem={(item) => {
        const returned = returnedInLabel(item);

        return (
          <div className="relative h-full">
            <ItemCard item={item} variant="compact" />

            {returned && (
              <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-background/90 px-2.5 py-1 text-xs font-medium text-success shadow-card backdrop-blur-sm">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {returned}
              </span>
            )}
          </div>
        );
      }}
      emptyCopy={{
        nothing: {
          title: 'No reunions yet',
          description:
            'Nothing has been returned so far. Lost and found reports are matched automatically — the first reunion will show up here.',
          action: { label: 'Report an item', href: '/post' },
        },
        noResults: {
          title: 'No resolved items match these filters',
          description:
            'Try a broader location, or clear the filters to read every story.',
        },
      }}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  );
}
