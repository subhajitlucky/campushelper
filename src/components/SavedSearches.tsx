'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellPlus, Bookmark, Loader2, Trash2 } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError, showSuccess } from '@/lib/toast-config';
import { cn } from '@/lib/utils';
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
    <section
      className={cn('rounded-lg border border-gray-200 bg-white p-4 shadow-sm', className)}
      aria-labelledby="saved-searches-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="saved-searches-heading"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-900"
        >
          <Bookmark className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Saved searches
          {searches.length > 0 && (
            <span className="text-gray-500">
              ({searches.length}/{MAX_SAVED_SEARCHES_PER_USER})
            </span>
          )}
        </h2>

        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving || atLimit}
          title={atLimit ? 'Delete one to make room' : undefined}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <BellPlus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Save this search
        </button>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : searches.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          Save a filter set and you will be notified when a matching item is posted.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {searches.map((search) => (
            <li key={search.id} className="flex items-center justify-between gap-3 py-2">
              <button
                type="button"
                onClick={() => onApply?.(search.filters)}
                disabled={!onApply}
                className="min-w-0 flex-1 text-left text-sm text-gray-800 transition-colors hover:text-blue-700 disabled:cursor-default"
              >
                <span className="font-medium">{search.name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {describeFilters(search.filters)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void remove(search.id)}
                disabled={pendingId === search.id}
                aria-label={`Delete saved search ${search.name}`}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {pendingId === search.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
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
