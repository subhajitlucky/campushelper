import { prisma } from './prisma';
import { notify } from './notifications';
import type { SavedSearchFilters } from './schemas/saved-search';

/**
 * Evaluates saved searches against newly posted items.
 *
 * A saved search is only ever matched against items posted *after* it was
 * created, so saving a search never floods the owner with notifications about
 * the existing backlog.
 */

/** Hard cap on how many saved searches are evaluated per new item. */
export const MAX_SAVED_SEARCHES_EVALUATED = 500;

export interface MatchableSavedSearchItem {
  id: string;
  title: string;
  description: string;
  location: string;
  itemType: 'LOST' | 'FOUND';
  categoryId: string | null;
  zoneId: string | null;
  tags: string[];
  createdAt: Date;
}

interface TaxonomyLookups {
  categoryIdBySlug: Map<string, string>;
  zoneIdBySlug: Map<string, string>;
}

function containsInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Whether an item satisfies a saved search's filters.
 *
 * Pure, so it can be reasoned about and tested without a database. Every filter
 * that is present must match; absent filters are not constraints.
 */
export function itemMatchesFilters(
  item: MatchableSavedSearchItem,
  filters: SavedSearchFilters,
  lookups: TaxonomyLookups
): boolean {
  if (filters.itemType && filters.itemType !== item.itemType) return false;

  if (filters.search) {
    const hit =
      containsInsensitive(item.title, filters.search) ||
      containsInsensitive(item.description, filters.search) ||
      containsInsensitive(item.location, filters.search);
    if (!hit) return false;
  }

  if (filters.category) {
    const wantedId = lookups.categoryIdBySlug.get(filters.category);
    // An unknown slug can never match; without this, a typo would match
    // every uncategorised item as a bonus.
    if (!wantedId || item.categoryId !== wantedId) return false;
  }

  if (filters.zone) {
    const wantedId = lookups.zoneIdBySlug.get(filters.zone);
    if (!wantedId || item.zoneId !== wantedId) return false;
  }

  if (filters.tags && filters.tags.length > 0) {
    const itemTags = new Set(item.tags.map((tag) => tag.toLowerCase()));
    const allPresent = filters.tags.every((tag) => itemTags.has(tag.toLowerCase()));
    if (!allPresent) return false;
  }

  if (filters.from && item.createdAt.getTime() < Date.parse(filters.from)) return false;
  if (filters.to && item.createdAt.getTime() > Date.parse(filters.to)) return false;

  return true;
}

/**
 * Notify owners of saved searches that a new item matches.
 *
 * Returns how many notifications were created. Never throws: this runs after
 * the item is already created, so a failure must not fail the request.
 */
export async function evaluateSavedSearchesForItem(
  item: MatchableSavedSearchItem
): Promise<number> {
  try {
    const searches = await prisma.savedSearch.findMany({
      where: {
        // Only searches that existed before this item was posted.
        createdAt: { lt: item.createdAt },
        user: { isActive: true },
      },
      select: { id: true, userId: true, name: true, filters: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAVED_SEARCHES_EVALUATED,
    });

    if (searches.length === 0) return 0;

    const [categories, zones] = await Promise.all([
      prisma.category.findMany({ select: { id: true, slug: true } }),
      prisma.campusZone.findMany({ select: { id: true, slug: true } }),
    ]);

    const lookups: TaxonomyLookups = {
      categoryIdBySlug: new Map(categories.map((c) => [c.slug, c.id])),
      zoneIdBySlug: new Map(zones.map((z) => [z.slug, z.id])),
    };

    let notified = 0;

    for (const search of searches) {
      const filters = search.filters as unknown as SavedSearchFilters;

      if (!itemMatchesFilters(item, filters, lookups)) continue;

      const created = await notify({
        userId: search.userId,
        type: 'SAVED_SEARCH_HIT',
        itemId: item.id,
        itemTitle: item.title,
        query: search.name,
        link: `/item/${item.id}`,
      });

      if (created) {
        notified += 1;
        await prisma.savedSearch.update({
          where: { id: search.id },
          data: { lastNotifiedAt: new Date() },
        });
      }
    }

    return notified;
  } catch (error) {
    console.error('[saved-searches] failed to evaluate saved searches', {
      itemId: item.id,
      error,
    });
    return 0;
  }
}
