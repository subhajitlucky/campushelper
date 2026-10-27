'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

import CategoryFilter from '@/components/CategoryFilter';
import ItemListShell, {
  type ListItem,
  type ListSelectConfig,
} from '@/components/ItemListShell';
import SavedSearches from '@/components/SavedSearches';
import { Button } from '@/components/ui/button';

type Item = ListItem;

interface SearchFilters {
  search: string;
  itemType: string;
  status: string;
  location: string;
  from: string;
  to: string;
  category: string;
}

const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'LOST', label: 'Lost items' },
  { value: 'FOUND', label: 'Found items' },
] as const;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'LOST', label: 'Lost' },
  { value: 'FOUND', label: 'Found' },
  { value: 'CLAIMED', label: 'Claimed' },
  { value: 'RESOLVED', label: 'Resolved' },
] as const;

const LOCATION_OPTIONS = [
  { value: '', label: 'All locations' },
  { value: 'Library', label: 'Library' },
  { value: 'Engineering Building', label: 'Engineering Building' },
  { value: 'Cafeteria', label: 'Cafeteria' },
  { value: 'Student Center', label: 'Student Center' },
  { value: 'Gym', label: 'Gym' },
  { value: 'Main Hall', label: 'Main Hall' },
] as const;

/**
 * Search — the filterable index of every report.
 *
 * The results stay empty until the first explicit search: the shell is handed
 * an `idle` intro until then, and refetches on every filter change after it.
 * The API is queried through the same params as before; only the presentation
 * around it changed.
 */
export default function SearchPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [user, setUser] = useState<{ isLoggedIn: boolean; userId?: string }>({
    isLoggedIn: false,
  });
  const [filters, setFilters] = useState<SearchFilters>({
    search: '',
    itemType: '',
    status: '',
    location: '',
    from: '',
    to: '',
    category: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchNonce, setSearchNonce] = useState(0);
  const limit = 20;

  // Every fetch gets a sequence number and owns an AbortController. A slow
  // response for an older filter can then neither overwrite newer results nor
  // leave the spinner running.
  const requestSeq = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      inFlight.current?.abort();
      requestSeq.current += 1;
    },
    []
  );

  const fetchItems = useCallback(async () => {
    inFlight.current?.abort();

    const controller = new AbortController();
    inFlight.current = controller;
    const requestId = ++requestSeq.current;

    try {
      setLoading(true);
      setSearchError(null);
      setHasSearched(true);

      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.itemType && { itemType: filters.itemType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.location && { location: filters.location }),
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
        ...(filters.category && { category: filters.category }),
      });

      const response = await fetch(`/api/items?${queryParams.toString()}`, {
        signal: controller.signal,
      });

      if (requestId !== requestSeq.current) return;

      if (!response.ok) {
        // Handle HTTP errors gracefully without throwing
        let errorMessage = 'Failed to search items. Please try again.';

        if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (response.status >= 400) {
          errorMessage = 'Search request failed. Please check your input.';
        }

        setSearchError(errorMessage);
        setItems([]);
        return;
      }

      const data = await response.json();

      if (requestId !== requestSeq.current) return;

      setItems(data.items || []);
      setCurrentPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);

      setUser(data.user || { isLoggedIn: false });
    } catch {
      if (controller.signal.aborted || requestId !== requestSeq.current) return;

      setItems([]);
      setSearchError('Network error. Please check your connection and try again.');
    } finally {
      if (requestId === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [filters, currentPage, limit]);

  // Don't auto-load on mount — wait for the first search, then refetch when the
  // filters, page, or an explicit submit change. `onPageChange` only sets the
  // page; this effect performs the single GET for it.
  useEffect(() => {
    if (hasSearched) {
      void fetchItems();
    }
  }, [fetchItems, searchNonce, hasSearched]);

  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    updateFilters({
      search: '',
      itemType: '',
      status: '',
      location: '',
      from: '',
      to: '',
      category: '',
    });
  };

  // Saved searches only store filters that GET /api/items understands, so
  // `status` and `location` are deliberately not offered for saving.
  const savedSearchFilters = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.itemType ? { itemType: filters.itemType as 'LOST' | 'FOUND' } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };

  const selects: ListSelectConfig[] = [
    {
      id: 'filter-item-type',
      label: 'Item type',
      value: filters.itemType,
      options: ITEM_TYPE_OPTIONS,
      onChange: (value) => updateFilters({ itemType: value }),
      className: 'sm:w-40',
    },
    {
      id: 'filter-status',
      label: 'Status',
      value: filters.status,
      options: STATUS_OPTIONS,
      onChange: (value) => updateFilters({ status: value }),
      className: 'sm:w-40',
    },
    {
      id: 'filter-location',
      label: 'Location',
      value: filters.location,
      options: LOCATION_OPTIONS,
      onChange: (value) => updateFilters({ location: value }),
      className: 'sm:w-48',
    },
  ];

  // `from`/`to` have no control in the bar — they arrive from a saved search —
  // so the count has to account for them or the page would claim "nothing yet"
  // about a filtered, empty result set.
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.itemType ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0);

  return (
    <ItemListShell
      title="Search"
      description="Search every report, then narrow by type, status, or place."
      noun={{ singular: 'result', plural: 'results' }}
      actions={
        <Button asChild variant="outline">
          <Link href="/post">Report an item</Link>
        </Button>
      }
      items={items}
      total={total}
      loading={loading}
      error={searchError}
      onRetry={() => setSearchNonce((value) => value + 1)}
      search={{
        id: 'search',
        label: 'Search items',
        // Measured: the input is 288px wide with 240px of usable text space,
        // and the old placeholder needed 294px, so it clipped mid-word to
        // "…description, or lo". The longer explanation already lives in the
        // empty state below, so the placeholder only has to name the field.
        placeholder: 'Search reports…',
        value: filters.search,
        onChange: (value) => updateFilters({ search: value }),
        onSubmit: () => {
          setHasSearched(true);
          setSearchNonce((value) => value + 1);
        },
        submitLabel: 'Search',
        busy: loading,
      }}
      selects={selects}
      facets={
        <CategoryFilter
          value={filters.category || null}
          onChange={(slug) => updateFilters({ category: slug ?? '' })}
        />
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      beforeFilters={
        user.isLoggedIn ? (
          <SavedSearches
            currentFilters={savedSearchFilters}
            onApply={(applied) => {
              // Replace the whole filter state. A saved search is a complete
              // query; merging it left a stale Status or Location behind, so
              // the results were not the search the user just applied.
              setFilters({
                search: applied.search ?? '',
                itemType: applied.itemType ?? '',
                status: '',
                location: '',
                category: applied.category ?? '',
                from: applied.from ?? '',
                to: applied.to ?? '',
              });
              setCurrentPage(1);
              setHasSearched(true);
              setSearchNonce((value) => value + 1);
            }}
          />
        ) : undefined
      }
      idle={!hasSearched ? <SearchIntro /> : undefined}
      emptyCopy={{
        nothing: {
          title: 'No items have been reported yet',
          description:
            'The board is empty. Post what you lost or found, and it will show up here.',
          action: { label: 'Report an item', href: '/post' },
        },
        noResults: {
          title: filters.search
            ? `Nothing matches “${filters.search}”`
            : 'No items match these filters',
          description:
            'Try fewer words, a different spelling, or clear the filters to search the whole board.',
        },
      }}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={(page) => {
        // The effect above performs the fetch; calling it here too sent two
        // requests for every page change.
        setCurrentPage(page);
      }}
    />
  );
}

/**
 * The pre-search state. It is deliberately not an empty state: nothing has
 * failed and nothing is missing — the page is simply waiting for a query.
 */
function SearchIntro() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <PackageSearch
        className="mx-auto size-12 text-muted-foreground/70"
        aria-hidden="true"
      />
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
        Start your search
      </h2>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">
        Search by title, description, or location, or narrow the board by type,
        status, and place.
      </p>

      <ul className="mt-6 space-y-2 text-left text-base leading-relaxed text-foreground/85">
        <li>Try the thing itself: “laptop”, “phone”, “keys”, “wallet”.</li>
        <li>Separate lost reports from found ones with the type filter.</li>
        <li>
          Log in to save a search and get notified when a match is posted.
        </li>
      </ul>

      <p className="mt-8 text-base text-muted-foreground">
        Looking for something specific?{' '}
        <Link
          href="/lost-items"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Browse lost items
        </Link>{' '}
        or read the{' '}
        <Link
          href="/resolved"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          resolved stories
        </Link>
        .
      </p>
    </div>
  );
}
