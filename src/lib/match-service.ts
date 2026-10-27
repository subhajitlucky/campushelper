import { prisma } from './prisma';
import {
  MATCH_THRESHOLD,
  MATCH_WINDOW_DAYS,
  rankMatches,
  type MatchableItem,
  type MatchReason,
} from './matching';
import { notifyMany, type NotifyInput } from './notifications';
import type { Prisma } from '../generated/prisma';

/**
 * Convert match reasons into a shape Prisma accepts for a JSON column.
 *
 * The cast is needed because a typed interface array has no index signature,
 * which `InputJsonValue` requires.
 */
function reasonsToJson(reasons: readonly MatchReason[]): Prisma.InputJsonValue {
  return reasons.map((reason) => ({
    code: reason.code,
    label: reason.label,
    weight: reason.weight,
  })) as unknown as Prisma.InputJsonValue;
}

/**
 * Applies the pure match engine to stored items.
 *
 * Candidate selection is bounded in SQL — complementary type, live status,
 * inside the date window, and a hard row cap — so scoring never degrades into a
 * table scan as the campus accumulates reports.
 */

/** Maximum candidates scored for one item. */
export const MAX_MATCH_CANDIDATES = 200;

const CANDIDATE_SELECT = {
  id: true,
  title: true,
  description: true,
  itemType: true,
  location: true,
  categoryId: true,
  zoneId: true,
  tags: true,
  createdAt: true,
} as const;

/** Statuses that can still be matched. Resolved and deleted items are excluded. */
const OPEN_STATUSES = ['LOST', 'FOUND', 'CLAIMED'] as const;

interface CandidateRow {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  location: string;
  categoryId: string | null;
  zoneId: string | null;
  tags: string[];
  createdAt: Date;
}

function toMatchable(row: CandidateRow): MatchableItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    itemType: row.itemType,
    location: row.location,
    categoryId: row.categoryId,
    zoneId: row.zoneId,
    tags: row.tags,
    createdAt: row.createdAt,
  };
}

/**
 * Score `itemId` against every plausible counterpart and persist the strong
 * pairs as suggestions.
 *
 * Existing suggestions are updated in place (upsert on the unique pair), so a
 * dismissed suggestion is not resurrected by recomputation. Returns the number
 * of suggestions created or refreshed.
 */
export async function computeMatchesForItem(itemId: string): Promise<number> {
  try {
    const subject = await prisma.item.findUnique({
      where: { id: itemId },
      select: { ...CANDIDATE_SELECT, status: true, deletedAt: true },
    });

    if (!subject || subject.deletedAt) return 0;

    const windowStart = new Date(
      subject.createdAt.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const windowEnd = new Date(
      subject.createdAt.getTime() + MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const candidates = await prisma.item.findMany({
      where: {
        id: { not: subject.id },
        // A LOST report is only ever matched against FOUND reports.
        itemType: subject.itemType === 'LOST' ? 'FOUND' : 'LOST',
        status: { in: [...OPEN_STATUSES] },
        deletedAt: null,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: CANDIDATE_SELECT,
      orderBy: { createdAt: 'desc' },
      take: MAX_MATCH_CANDIDATES,
    });

    if (candidates.length === 0) return 0;

    const ranked = rankMatches(
      toMatchable(subject),
      candidates.map(toMatchable),
      MATCH_THRESHOLD
    );

    if (ranked.length === 0) return 0;

    // Every ranked pair shares one side — the subject — so the existence check
    // is a single indexed lookup rather than one `findUnique` per pair.
    const pairs = ranked.map((match) => ({
      lostItemId: subject.itemType === 'LOST' ? subject.id : match.item.id,
      foundItemId: subject.itemType === 'LOST' ? match.item.id : subject.id,
      score: match.score,
      reasons: reasonsToJson(match.reasons),
    }));

    const existingRows = await prisma.matchSuggestion.findMany({
      where:
        subject.itemType === 'LOST'
          ? { lostItemId: subject.id, foundItemId: { in: pairs.map((p) => p.foundItemId) } }
          : { foundItemId: subject.id, lostItemId: { in: pairs.map((p) => p.lostItemId) } },
      select: { id: true, lostItemId: true, foundItemId: true, status: true, score: true },
    });

    const existingByPair = new Map(
      existingRows.map((row) => [`${row.lostItemId}|${row.foundItemId}`, row])
    );

    const toCreate: typeof pairs = [];
    // Refreshes are grouped by their new value, so a page of pairs that all
    // rescore the same way costs one UPDATE rather than one per row.
    const updatesByValue = new Map<
      string,
      { score: number; reasons: Prisma.InputJsonValue; ids: string[] }
    >();

    for (const pair of pairs) {
      const existing = existingByPair.get(`${pair.lostItemId}|${pair.foundItemId}`);

      if (!existing) {
        toCreate.push(pair);
        continue;
      }

      // A dismissed pair stays dismissed; only the score is refreshed.
      if (existing.status === 'DISMISSED' || existing.score === pair.score) continue;

      const key = `${pair.score}|${pair.reasons}`;
      const group = updatesByValue.get(key);

      if (group) {
        group.ids.push(existing.id);
      } else {
        updatesByValue.set(key, {
          score: pair.score,
          reasons: pair.reasons,
          ids: [existing.id],
        });
      }
    }

    // `skipDuplicates` is what makes this safe under concurrency. The previous
    // find-then-create raised P2002 when two items were created at once and the
    // two computations shared a pair; because the throw escaped the whole loop
    // into the outer catch, the losing item silently persisted only the pairs
    // it had already written and returned 0. Reproduced: 4 of 6 concurrent
    // complementary creations lost 144-169 of their 200 pairs, permanently, with
    // no error surfaced and no notifications sent.
    if (toCreate.length > 0) {
      await prisma.matchSuggestion.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    for (const group of updatesByValue.values()) {
      await prisma.matchSuggestion.updateMany({
        where: { id: { in: group.ids } },
        data: { score: group.score, reasons: group.reasons },
      });
    }

    // Notify for everything this run considers new. A pair that a concurrent
    // run created first is skipped above as "existing", and any duplicate that
    // still slips through is collapsed by the notification dedupe window.
    if (toCreate.length > 0) {
      await notifyMatchOwners(toCreate);
    }

    return pairs.length;
  } catch (error) {
    console.error('[matching] failed to compute matches', { itemId, error });
    return 0;
  }
}

/**
 * Tell both owners about each new suggestion.
 *
 * Owners are looked up in one query per batch rather than per pair, and the
 * notification body carries the counterpart's title so the recipient can judge
 * the match from the inbox alone.
 *
 * This used to await `notify()` twice per pair, and `notify()` is a `findFirst`
 * plus a `create` — four statements per pair, 800 for a 200-pair run. It now
 * builds the whole batch and hands it to `notifyMany`, which writes it in two.
 */
async function notifyMatchOwners(
  created: readonly { lostItemId: string; foundItemId: string; score: number }[]
): Promise<void> {
  const itemIds = [
    ...new Set(created.flatMap((pair) => [pair.lostItemId, pair.foundItemId])),
  ];

  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, title: true, postedById: true },
  });

  const byId = new Map(items.map((item) => [item.id, item]));

  const batch: NotifyInput[] = [];

  for (const pair of created) {
    const lost = byId.get(pair.lostItemId);
    const found = byId.get(pair.foundItemId);
    if (!lost || !found) continue;

    // Each owner hears about the *other* report.
    batch.push({
      userId: lost.postedById,
      type: 'MATCH_FOUND',
      itemId: lost.id,
      itemTitle: found.title,
      link: `/item/${lost.id}`,
    });

    batch.push({
      userId: found.postedById,
      type: 'MATCH_FOUND',
      itemId: found.id,
      itemTitle: lost.title,
      link: `/item/${found.id}`,
    });
  }

  await notifyMany(batch);
}

export interface MatchView {
  id: string;
  score: number;
  reasons: MatchReason[];
  status: 'SUGGESTED' | 'DISMISSED' | 'CONFIRMED';
  counterpart: {
    id: string;
    title: string;
    description: string;
    itemType: 'LOST' | 'FOUND';
    location: string;
    images: string[];
    status: string;
    createdAt: string;
  };
}

/**
 * Suggestions for one item, from the perspective of either owner.
 *
 * Only `SUGGESTED` and `CONFIRMED` matches are returned by default: a dismissed
 * pair is the user's decision and is not surfaced again.
 */
export async function getMatchesForItem(
  itemId: string,
  options: { includeDismissed?: boolean } = {}
): Promise<MatchView[]> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, itemType: true },
  });

  if (!item) return [];

  // A suggestion pointing at a moderated-away report is not actionable: the
  // counterpart may still exist in the database, but every list and its detail
  // page treat it as gone.
  const visibleCounterpart: Prisma.ItemWhereInput = {
    deletedAt: null,
    status: { not: 'DELETED' },
    moderationStatus: { not: 'REMOVED' },
  };

  const rows = await prisma.matchSuggestion.findMany({
    where: {
      ...(item.itemType === 'LOST'
        ? { lostItemId: itemId, foundItem: visibleCounterpart }
        : { foundItemId: itemId, lostItem: visibleCounterpart }),
      ...(options.includeDismissed ? {} : { status: { in: ['SUGGESTED', 'CONFIRMED'] } }),
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    include: {
      lostItem: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          images: true,
          status: true,
          createdAt: true,
          postedById: true,
        },
      },
      foundItem: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          images: true,
          status: true,
          createdAt: true,
          postedById: true,
        },
      },
    },
  });

  return rows.map((row) => {
    const counterpart = row.lostItemId === itemId ? row.foundItem : row.lostItem;

    return {
      id: row.id,
      score: row.score,
      reasons: (row.reasons ?? []) as unknown as MatchReason[],
      status: row.status,
      counterpart: {
        id: counterpart.id,
        title: counterpart.title,
        description: counterpart.description,
        itemType: row.lostItemId === itemId ? 'FOUND' : 'LOST',
        location: counterpart.location,
        images: counterpart.images,
        status: counterpart.status,
        createdAt: counterpart.createdAt.toISOString(),
      },
    };
  });
}
