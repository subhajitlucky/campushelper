import { prisma } from './prisma';
import { notifyMany } from './notifications';
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
  /** The item's poster, so a saved search never alerts them about their own post. */
  postedById: string;
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

    // Collect first, write once. The loop used to await `notify()` (a
    // `findFirst` + a `create`) and then a `savedSearch.update` per matching
    // search — three round trips each, measured at 1,735.9 ms for 200 matches
    // and 4,078.2 ms at the 500 cap.
    const matching: typeof searches = [];

    for (const search of searches) {
      // Posting an item should not notify you through your own saved search.
      if (search.userId === item.postedById) continue;

      const filters = search.filters as unknown as SavedSearchFilters;

      if (!itemMatchesFilters(item, filters, lookups)) continue;

      matching.push(search);
    }

    if (matching.length === 0) return 0;

    const created = await notifyMany(
      matching.map((search) => ({
        userId: search.userId,
        type: 'SAVED_SEARCH_HIT' as const,
        itemId: item.id,
        itemTitle: item.title,
        query: search.name,
        link: `/item/${item.id}`,
      }))
    );

    // One UPDATE for every matched search instead of one per notification.
    // `lastNotifiedAt` records that the search was evaluated against this item,
    // which is true whether or not the notification itself was deduped — so
    // this deliberately covers all matches, matching the original behaviour in
    // the common case and avoiding a second query to find out which.
    await prisma.savedSearch.updateMany({
      where: { id: { in: matching.map((search) => search.id) } },
      data: { lastNotifiedAt: new Date() },
    });

    notified = created;

    return notified;
  } catch (error) {
    console.error('[saved-searches] failed to evaluate saved searches', {
      itemId: item.id,
      error,
    });
    return 0;
  }
}
