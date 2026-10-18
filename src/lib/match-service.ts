import { prisma } from './prisma';
import {
  MATCH_THRESHOLD,
  MATCH_WINDOW_DAYS,
  rankMatches,
  type MatchableItem,
  type MatchReason,
} from './matching';
import { notify } from './notifications';
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

    let persisted = 0;
    const newlyCreated: { lostItemId: string; foundItemId: string; score: number }[] = [];

    for (const match of ranked) {
      const lostItemId = subject.itemType === 'LOST' ? subject.id : match.item.id;
      const foundItemId = subject.itemType === 'LOST' ? match.item.id : subject.id;

      const existing = await prisma.matchSuggestion.findUnique({
        where: { lostItemId_foundItemId: { lostItemId, foundItemId } },
        select: { id: true, status: true, score: true },
      });

      // A dismissed pair stays dismissed; only the score is refreshed.
      if (existing) {
        if (existing.status !== 'DISMISSED' && existing.score !== match.score) {
          await prisma.matchSuggestion.update({
            where: { id: existing.id },
            data: { score: match.score, reasons: reasonsToJson(match.reasons) },
          });
        }
        persisted += 1;
        continue;
      }

      await prisma.matchSuggestion.create({
        data: {
          lostItemId,
          foundItemId,
          score: match.score,
          reasons: reasonsToJson(match.reasons),
        },
      });

      newlyCreated.push({ lostItemId, foundItemId, score: match.score });
      persisted += 1;
    }

    if (newlyCreated.length > 0) {
      await notifyMatchOwners(newlyCreated);
    }

    return persisted;
  } catch (error) {
    console.error('[matching] failed to compute matches', { itemId, error });
    return 0;
  }
}

/**
 * Tell both owners about each new suggestion.
 *
 * Owners are looked up in one query per pair rather than per item, and the
 * notification body carries the counterpart's title so the recipient can judge
 * the match from the inbox alone.
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

  for (const pair of created) {
    const lost = byId.get(pair.lostItemId);
    const found = byId.get(pair.foundItemId);
    if (!lost || !found) continue;

    // Each owner hears about the *other* report.
    await notify({
      userId: lost.postedById,
      type: 'MATCH_FOUND',
      itemId: lost.id,
      itemTitle: found.title,
      link: `/item/${lost.id}`,
    });

    await notify({
      userId: found.postedById,
      type: 'MATCH_FOUND',
      itemId: found.id,
      itemTitle: lost.title,
      link: `/item/${found.id}`,
    });
  }
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

  const rows = await prisma.matchSuggestion.findMany({
    where: {
      ...(item.itemType === 'LOST' ? { lostItemId: itemId } : { foundItemId: itemId }),
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
