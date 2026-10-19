'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useId, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import EmptyState, { EmptyStateIcons } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import ItemCard from '@/components/ui/ItemCard';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCardGrid } from '@/components/ui/SkeletonCard';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One report, shaped exactly like a row of `GET /api/items`.
 *
 * `category` and `zone` are part of that projection — the list pages used to
 * drop them on the way to the card, which is why every card fell back to a
 * generic image icon and a raw location string.
 */
export interface ListItem {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
  /** Present on the resolved feed; drives the "returned in N days" line. */
  resolvedAt?: string | null;
  images?: string[] | null;
  tags?: string[] | null;
  postedBy: {
    id?: string;
    name: string | null;
    avatar: string | null;
    reputation?: number | null;
  };
  category?: { slug: string; name: string; icon: string } | null;
  zone?: { slug: string; name: string } | null;
}

/** The search box — the only control with a submit affordance. */
export interface ListSearchConfig {
  /** Preserved from the page it replaces. Defaults to `search`. */
  id?: string;
  /** Accessible name; rendered visually hidden. */
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the submit button when one is rendered. */
  onSubmit?: () => void;
  /** When set, a submit button with this label sits beside the field. */
  submitLabel?: string;
  busy?: boolean;
}

/** A plain text filter — `location` on the lost and resolved feeds. */
export interface ListTextConfig {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

/** A native select. `id` is also the `<label htmlFor>` target. */
export interface ListSelectConfig {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Width hint for the desktop row; defaults to `sm:w-44`. */
  className?: string;
}

export interface ListEmptyCopy {
  /** Nothing exists yet — no filters are applied. */
  nothing?: {
    title: string;
    description?: string;
    /** Where to go next: "Report an item", "Browse everything". */
    action?: { label: string; href: string };
  };
  /** Filters or a search are applied and matched nothing. */
  noResults?: {
    title: string;
    description?: string;
  };
}

export interface ItemListShellProps {
  /** The page's only h1. */
  title: string;
  /** One line of context under the title. */
  description?: string;
  /** Singular/plural noun for the count line: "lost item" / "lost items". */
  noun: { singular: string; plural: string };
  /** Right-aligned header actions. */
  actions?: React.ReactNode;

  items: ListItem[];
  /** Total matches from the `pagination` envelope — never `items.length`. */
  total: number;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;

  search?: ListSearchConfig;
  texts?: readonly ListTextConfig[];
  selects?: readonly ListSelectConfig[];
  /** Chip row (CategoryFilter) folded into the same filter region. */
  facets?: React.ReactNode;
  facetsLabel?: string;
  /**
   * Number of filters that deviate from their default. Drives the mobile badge
   * and the "no results for these filters" state. Pass it when a filter has no
   * visible control (a date range applied from a saved search) or lives in
   * `facets`; otherwise the shell counts the controls it renders.
   */
  activeFilterCount?: number;
  onClearFilters?: () => void;

  /** Shown before the first query — the search page's intro. */
  idle?: React.ReactNode;

  /** Override the default ItemCard (e.g. to add a per-card line). */
  renderItem?: (item: ListItem) => React.ReactNode;
  /** Props for the default ItemCard; ignored when `renderItem` is given. */
  cardProps?: {
    user?: { isLoggedIn: boolean; userId?: string };
    showActions?: boolean;
    onFound?: (item: ListItem) => void;
    variant?: 'default' | 'compact';
  };

  emptyCopy?: ListEmptyCopy;

  /** Sits between the page header and the filter bar (SavedSearches). */
  beforeFilters?: React.ReactNode;

  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;

  loadingCount?: number;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

/** Shared geometry for every control in the filter bar. */
const controlClasses =
  'h-10 rounded-lg border border-input bg-card text-base text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * ItemListShell
 *
 * The frame `/search`, `/lost-items` and `/resolved` share: one page header,
 * one filter region, one results grid, one pagination. The three pages were
 * near-duplicate hand-rollings of the same thing, and each had drifted — a
 * dead filter here, a broken count there.
 *
 * Design rules it encodes (brief §4.2):
 *   - filters are inline on one row, `h-10`, and collapse behind a single
 *     "Filters" disclosure with an active-count badge on mobile;
 *   - every control keeps an explicit label association (`htmlFor`/`id`) and
 *     an accessible name, whether or not the label is visible;
 *   - results are image-led cards in a 1/2/3/4 column grid, and the loading
 *     state is the same grid of skeletons — never a spinner;
 *   - "nothing yet" and "no results for these filters" are different states,
 *     and only the second offers a way out.
 */
export default function ItemListShell({
  title,
  description,
  noun,
  actions,
  items,
  total,
  loading,
  error,
  onRetry,
  search,
  texts,
  selects,
  facets,
  facetsLabel = 'Category',
  activeFilterCount,
  onClearFilters,
  idle,
  renderItem,
  cardProps,
  emptyCopy,
  beforeFilters,
  currentPage,
  totalPages,
  onPageChange,
  loadingCount = 8,
  className,
}: ItemListShellProps) {
  const router = useRouter();
  const panelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searchId = search?.id ?? 'search';

  const computedFilterCount =
    (search?.value ? 1 : 0) +
    (texts?.filter((control) => control.value !== '').length ?? 0) +
    (selects?.filter((control) => control.value !== '').length ?? 0);
  const filterCount = activeFilterCount ?? computedFilterCount;
  const filtersApplied = filterCount > 0;

  const showIdle = Boolean(idle) && !loading && !error && items.length === 0;
  const showCount = !loading && !error && !showIdle;

  const nothingCopy = emptyCopy?.nothing;
  const noResultsCopy = emptyCopy?.noResults;

  const nothingAction = nothingCopy?.action
    ? {
        label: nothingCopy.action.label,
        onClick: () => router.push(nothingCopy.action!.href),
      }
    : undefined;

  return (
    <div className={cn('page-canvas rise-in', className)}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <PageHeader
          title={title}
          description={description}
          actions={actions}
          meta={
            showCount ? (
              <span role="status" className="tabular-nums">
                {total} {total === 1 ? noun.singular : noun.plural}
              </span>
            ) : loading ? (
              <>
                <span className="sr-only">Loading results</span>
                <Skeleton className="h-4 w-24" aria-hidden="true" />
              </>
            ) : undefined
          }
        />

        {beforeFilters && <div className="mt-6">{beforeFilters}</div>}

        {/* ---------------------------------------------------------------- */}
        {/* Filter bar                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Filters" className="mt-6">
          {/* Mobile: one disclosure for every control */}
          <div className="sm:hidden">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              aria-expanded={filtersOpen}
              aria-controls={panelId}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
              </span>
              <span className="inline-flex items-center gap-2">
                {filterCount > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium tabular-nums text-primary-foreground">
                    {filterCount}
                    <span className="sr-only">
                      {' '}
                      active {filterCount === 1 ? 'filter' : 'filters'}
                    </span>
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform duration-150',
                    filtersOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </span>
            </Button>
          </div>

          <div
            id={panelId}
            className={cn(
              'flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center',
              filtersOpen ? 'flex' : 'hidden'
            )}
          >
            {search && (
              <form
                role="search"
                aria-label={search.label ?? 'Search items'}
                onSubmit={(event) => {
                  event.preventDefault();
                  search.onSubmit?.();
                }}
                className="flex w-full items-center gap-2 sm:w-auto"
              >
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none lg:w-72">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <label htmlFor={searchId} className="sr-only">
                    {search.label ?? 'Search items'}
                  </label>
                  <Input
                    id={searchId}
                    type="text"
                    value={search.value}
                    onChange={(event) => search.onChange(event.target.value)}
                    placeholder={search.placeholder ?? 'Search…'}
                    className="h-10 pl-9"
                  />
                </div>
                {(search.submitLabel || search.onSubmit) && (
                  <Button
                    type="submit"
                    className="shrink-0"
                    loading={search.busy}
                  >
                    {search.submitLabel ?? 'Search'}
                  </Button>
                )}
              </form>
            )}

            {selects?.map((control) => (
              <div
                key={control.id}
                className={cn('relative w-full sm:w-44', control.className)}
              >
                <label htmlFor={control.id} className="sr-only">
                  {control.label}
                </label>
                <select
                  id={control.id}
                  value={control.value}
                  onChange={(event) => control.onChange(event.target.value)}
                  className={cn(controlClasses, 'w-full appearance-none pl-3 pr-9')}
                >
                  {control.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            ))}

            {texts?.map((control) => (
              <div
                key={control.id}
                className={cn('w-full sm:w-52', control.className)}
              >
                <label htmlFor={control.id} className="sr-only">
                  {control.label}
                </label>
                <Input
                  id={control.id}
                  type="text"
                  value={control.value}
                  onChange={(event) => control.onChange(event.target.value)}
                  placeholder={control.placeholder ?? control.label}
                  className="h-10"
                />
              </div>
            ))}

            {filtersApplied && onClearFilters && (
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="shrink-0 self-start sm:ml-auto sm:self-auto"
                onClick={onClearFilters}
              >
                <X className="size-4" aria-hidden="true" />
                Clear filters
              </Button>
            )}

            {facets && (
              <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 pt-1 sm:pt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {facetsLabel}
                </span>
                {facets}
              </div>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Results                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-8">
          {error ? (
            <div
              role="alert"
              className="mx-auto flex max-w-md flex-col items-center py-16 text-center"
            >
              <AlertTriangle
                className="size-8 text-destructive"
                aria-hidden="true"
              />
              <p className="mt-4 text-base text-foreground/85">{error}</p>
              {onRetry && (
                <Button variant="outline" className="mt-6" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : loading ? (
            <SkeletonCardGrid count={loadingCount} />
          ) : showIdle ? (
            idle
          ) : items.length === 0 ? (
            filtersApplied ? (
              <EmptyState
                icon={EmptyStateIcons.search}
                title={noResultsCopy?.title ?? `No ${noun.plural} match these filters`}
                description={
                  noResultsCopy?.description ??
                  'Try a different search term, or clear the filters to see everything.'
                }
                action={
                  onClearFilters
                    ? { label: 'Clear filters', onClick: onClearFilters }
                    : undefined
                }
              />
            ) : (
              <EmptyState
                icon={EmptyStateIcons.items}
                title={nothingCopy?.title ?? `No ${noun.plural} yet`}
                description={nothingCopy?.description}
                action={nothingAction}
              />
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map((item) =>
                renderItem ? (
                  <Fragment key={item.id}>{renderItem(item)}</Fragment>
                ) : (
                  <ItemCard
                    key={item.id}
                    item={item}
                    user={cardProps?.user}
                    showActions={cardProps?.showActions ?? false}
                    onFound={cardProps?.onFound}
                    variant={cardProps?.variant ?? 'compact'}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Pagination stays mounted while a page loads, so the footer of the
            list does not jump on every page change. */}
        {!error && !showIdle && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            total={total}
            className="mt-10"
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Route-level loading state                                                  */
/* -------------------------------------------------------------------------- */

export interface ItemListLoadingProps {
  title: string;
  description?: string;
  /** Render a search-field placeholder. */
  search?: boolean;
  /** Number of text/select placeholders. */
  controls?: number;
  /** Render a category-chip placeholder row. */
  facets?: boolean;
  count?: number;
}

/**
 * ItemListLoading
 *
 * The route-level `loading.tsx` for a list page: the real header renders
 * immediately, the filter bar and the card grid shimmer in the geometry they
 * will settle into. No spinner anywhere.
 */
export function ItemListLoading({
  title,
  description,
  search = false,
  controls = 0,
  facets = false,
  count = 8,
}: ItemListLoadingProps) {
  return (
    <div className="page-canvas">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <PageHeader
          title={title}
          description={description}
          meta={
            <>
              <span className="sr-only">Loading results</span>
              <Skeleton className="h-4 w-24" aria-hidden="true" />
            </>
          }
        />

        {/* Below `sm` the real bar is a single collapsed disclosure, so the
            placeholder is one full-width control rather than six stacked ones —
            otherwise the page would jump when the filters arrive. */}
        <div className="mt-6" aria-hidden="true">
          <Skeleton className="h-10 w-full rounded-lg sm:hidden" />

          <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            {search && (
              <>
                <Skeleton className="h-10 w-72 rounded-lg" />
                <Skeleton className="h-10 w-24 rounded-lg" />
              </>
            )}
            {Array.from({ length: controls }, (_, index) => (
              <Skeleton key={index} className="h-10 w-44 rounded-lg" />
            ))}
            {facets && (
              <div className="flex w-full flex-wrap items-center gap-2 pt-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-8 w-28 rounded-full" />
                ))}
              </div>
            )}
          </div>
        </div>

        <SkeletonCardGrid count={count} className="mt-8" />
      </div>
    </div>
  );
}
