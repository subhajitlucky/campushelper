'use client';

import { useCallback, useEffect, useState } from 'react';
import { icons, Package, type LucideIcon } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A category as returned by `GET /api/categories`. */
export interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  /** lucide-react icon *name*, e.g. `"Smartphone"`. */
  icon: string;
  sortOrder?: number;
  itemCount: number;
}

interface CategoryFilterProps {
  value?: string | null;
  onChange: (slug: string | null) => void;
  /** Pre-fetched categories; when given, no request is made. */
  categories?: CategoryOption[];
  className?: string;
}

const ICONS = icons as unknown as Record<string, LucideIcon>;

/** Resolve a stored lucide name, falling back to a neutral box icon. */
function categoryIcon(name: string): LucideIcon {
  return ICONS[name] ?? Package;
}

/**
 * CategoryFilter Component
 *
 * Horizontal, wrapping row of category chips: icon, name, and live item count.
 * Clicking the active chip clears the filter, so the row is a self-contained
 * single-select control. Each chip carries `aria-pressed` for its state.
 */
export default function CategoryFilter({
  value = null,
  onChange,
  categories,
  className
}: CategoryFilterProps) {
  const { fetchWithAuth, isLoading: isAuthLoading } = useAuthFetch(true);
  const [fetchedCategories, setFetchedCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(!categories);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/categories');
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      setFetchedCategories(data.categories || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (categories || isAuthLoading) {
      return;
    }

    loadCategories();
  }, [categories, isAuthLoading, loadCategories]);

  const visibleCategories = categories ?? fetchedCategories;

  if (isLoading && visibleCategories.length === 0) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)} aria-busy="true">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
    );
  }

  if (error && visibleCategories.length === 0) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2 text-sm text-gray-500', className)}>
        <span>{error}</span>
        <button
          type="button"
          onClick={() => {
            void loadCategories();
          }}
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const chipClasses = (isActive: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
      isActive
        ? 'border-blue-600 bg-blue-600 text-white'
        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
    );

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Filter by category"
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={!value}
        className={chipClasses(!value)}
      >
        All
      </button>

      {visibleCategories.map((category) => {
        const Icon = categoryIcon(category.icon);
        const isActive = value === category.slug;

        return (
          <button
            key={category.slug}
            type="button"
            onClick={() => onChange(isActive ? null : category.slug)}
            aria-pressed={isActive}
            className={chipClasses(isActive)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{category.name}</span>
            <span className={cn('text-xs', isActive ? 'text-blue-100' : 'text-gray-500')}>
              {category.itemCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
