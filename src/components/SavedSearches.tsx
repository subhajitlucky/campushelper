'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellPlus, Bookmark, Loader2, Trash2 } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError, showSuccess } from '@/lib/toast-config';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SectionHeader from '@/components/ui/SectionHeader';
import { MAX_SAVED_SEARCHES_PER_USER } from '@/lib/schemas/saved-search';

/**
 * Saved searches: a named filter set that notifies its owner when a matching
 * item is posted.
 *
 * The filters sent here are the same shape `GET /api/items` accepts, so a saved
 * search can always be replayed against the live list.
 */

export interface SavedSearchFilters {
  search?: string;
  itemType?: 'LOST' | 'FOUND';
  category?: string;
  zone?: string;
  tags?: string[];
  from?: string;
  to?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  lastNotifiedAt: string | null;
  createdAt: string;
}

interface SavedSearchesProps {
  /** The filters to offer for saving. Empty filters are refused. */
  currentFilters: SavedSearchFilters;
  /** Called when the user clicks a saved search, to replay it. */
  onApply?: (filters: SavedSearchFilters) => void;
  className?: string;
}

export default function SavedSearches({
  currentFilters,
  onApply,
  className,
}: SavedSearchesProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSignedOut, setIsSignedOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/saved-searches');

      if (!response.ok) {
        if (response.status === 401) setIsSignedOut(true);
        setSearches([]);
        return;
      }

      const data = await response.json();
      setSearches(Array.isArray(data.savedSearches) ? data.savedSearches : []);
    } catch {
      setSearches([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Prune empty values so a blank filter is not stored as a constraint. */
  const meaningfulFilters = useCallback((): SavedSearchFilters => {
    const cleaned: SavedSearchFilters = {};

    if (currentFilters.search?.trim()) cleaned.search = currentFilters.search.trim();
    if (currentFilters.itemType) cleaned.itemType = currentFilters.itemType;
    if (currentFilters.category) cleaned.category = currentFilters.category;
    if (currentFilters.zone) cleaned.zone = currentFilters.zone;
    if (currentFilters.tags && currentFilters.tags.length > 0) {
      cleaned.tags = currentFilters.tags;
    }
    if (currentFilters.from) cleaned.from = currentFilters.from;
    if (currentFilters.to) cleaned.to = currentFilters.to;

    return cleaned;
  }, [currentFilters]);

  const save = useCallback(async () => {
    const filters = meaningfulFilters();

    if (Object.keys(filters).length === 0) {
      showError('Add at least one filter before saving a search.');
      return;
    }

    const suggested = filters.search
      ? filters.search
      : [filters.itemType, filters.category, filters.zone].filter(Boolean).join(' · ') ||
        'Saved search';

    const name = window.prompt('Name this search', suggested)?.trim();
    if (!name) return;

    setIsSaving(true);

    try {
      const response = await fetchWithAuth('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? 'Could not save this search.');
      }

      showSuccess(`Saved "${name}". You will be notified about matching items.`);
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }, [fetchWithAuth, load, meaningfulFilters]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this saved search? You will stop being notified.')) return;

      setPendingId(id);

      try {
        const response = await fetchWithAuth(`/api/saved-searches/${id}`, { method: 'DELETE' });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? 'Could not delete this search.');
        }

        setSearches((previous) => previous.filter((search) => search.id !== id));
        showSuccess('Saved search deleted.');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Something went wrong.');
      } finally {
        setPendingId(null);
      }
    },
    [fetchWithAuth]
  );

  // Signed-out visitors have nothing to save against.
  if (isSignedOut) return null;

  const atLimit = searches.length >= MAX_SAVED_SEARCHES_PER_USER;

  return (
    <section className={className} aria-labelledby="saved-searches-heading">
      <SectionHeader
        id="saved-searches-heading"
        divider={false}
        title={
          <span className="inline-flex items-center gap-2">
            <Bookmark className="size-5 text-primary" aria-hidden="true" />
            Saved searches
            {searches.length > 0 && (
              <span className="text-sm font-normal tabular-nums text-muted-foreground">
                {searches.length}/{MAX_SAVED_SEARCHES_PER_USER}
              </span>
            )}
          </span>
        }
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void save()}
            disabled={isSaving || atLimit}
            title={atLimit ? 'Delete one to make room' : undefined}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <BellPlus className="size-3.5" aria-hidden="true" />
            )}
            Save this search
          </Button>
        }
      />

      {isLoading ? (
        <div role="status" aria-busy="true">
          <ul className="mt-1 divide-y divide-border-subtle">
            {[1, 2].map((row) => (
              <li key={row} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </span>
                <Skeleton className="size-9 shrink-0 rounded-md" />
              </li>
            ))}
          </ul>
          <span className="sr-only">Loading saved searches…</span>
        </div>
      ) : searches.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Save a filter set and you will be notified when a matching item is posted.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-border-subtle">
          {searches.map((search) => (
            <li key={search.id} className="flex items-center justify-between gap-3 py-3">
              <button
                type="button"
                onClick={() => onApply?.(search.filters)}
                disabled={!onApply}
                className="group/row min-w-0 flex-1 rounded text-left transition-colors disabled:cursor-default"
              >
                <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover/row:text-primary">
                  {search.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {describeFilters(search.filters)}
                </span>
              </button>

              <Button
                type="button"
                variant="quiet"
                size="icon-sm"
                onClick={() => void remove(search.id)}
                disabled={pendingId === search.id}
                aria-label={`Delete saved search ${search.name}`}
                className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
              >
                {pendingId === search.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {atLimit && (
        <p className="mt-3 text-xs text-muted-foreground">
          You have reached the limit of {MAX_SAVED_SEARCHES_PER_USER} saved searches. Delete one to
          save another.
        </p>
      )}
    </section>
  );
}

/** Human summary of a filter set, for the list row. */
export function describeFilters(filters: SavedSearchFilters): string {
  const parts: string[] = [];

  if (filters.search) parts.push(`"${filters.search}"`);
  if (filters.itemType) parts.push(filters.itemType === 'LOST' ? 'lost items' : 'found items');
  if (filters.category) parts.push(filters.category);
  if (filters.zone) parts.push(filters.zone);
  if (filters.tags && filters.tags.length > 0) parts.push(filters.tags.map((t) => `#${t}`).join(' '));
  if (filters.from) parts.push(`from ${filters.from.slice(0, 10)}`);
  if (filters.to) parts.push(`to ${filters.to.slice(0, 10)}`);

  return parts.length > 0 ? parts.join(' · ') : 'Any item';
}
