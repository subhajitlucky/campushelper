import { jaccard, tokenize } from './text-similarity';

/**
 * Explainable scoring for pairing a LOST report with a FOUND report.
 *
 * The scorer is deterministic: the same pair of items always produces the same
 * score, and every point is attributed to a named signal so the UI can explain
 * *why* two reports were paired. There is no machine learning here, and no
 * database access — the caller supplies plain objects.
 */

/** Minimum score at which a pair is surfaced as a suggestion. */
export const MATCH_THRESHOLD = 55;

/**
 * Fraction of the *achievable* score at or above which a new post looks like a
 * duplicate.
 *
 * This is a ratio, not an absolute score, and that is load-bearing. The signal
 * weights include category (18) and tags (6), which are absent when the poster
 * left those fields blank. With an absolute threshold of 70, two byte-identical
 * reports scored 68 -- the exact maximum achievable without a category -- so the
 * guard could never fire for the most common case, a double-submitted form.
 * Comparing against what is achievable for that pair makes the guard work
 * regardless of which optional fields are filled in.
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;

/**
 * Total weight scoreable for this pair, mirroring the branches in
 * {@link scoreSimilarity}: category only counts when both sides have one, and
 * zone and location text are mutually exclusive.
 */
export function achievableWeight(a: MatchableItem, b: MatchableItem): number {
  let weight = MATCH_WEIGHTS.title + MATCH_WEIGHTS.description + MATCH_WEIGHTS.date;

  if (a.categoryId && b.categoryId) weight += MATCH_WEIGHTS.category;

  weight += a.zoneId && b.zoneId ? MATCH_WEIGHTS.zone : MATCH_WEIGHTS.location;

  if ((a.tags?.length ?? 0) > 0 && (b.tags?.length ?? 0) > 0) weight += MATCH_WEIGHTS.tags;

  return weight;
}

/**
 * How duplicate-like two reports are, as a fraction in `[0, 1]` of the score
 * that was achievable for them.
 */
export function duplicateSimilarity(a: MatchableItem, b: MatchableItem): number {
  const achievable = achievableWeight(a, b);
  if (achievable <= 0) return 0;

  return Math.min(scoreSimilarity(a, b).score / achievable, 1);
}

/** Date proximity decays linearly to zero at this separation. */
export const MATCH_WINDOW_DAYS = 180;

/** Signal weights. They sum to 96 when a zone match is present. */
export const MATCH_WEIGHTS = {
  title: 34,
  description: 16,
  category: 18,
  zone: 14,
  location: 10,
  date: 8,
  tags: 6,
} as const;

export type MatchReasonCode =
  | 'title_overlap'
  | 'description_overlap'
  | 'same_category'
  | 'same_zone'
  | 'similar_location'
  | 'close_in_time'
  | 'shared_tags';

export interface MatchReason {
  code: MatchReasonCode;
  label: string;
  weight: number;
}

export interface MatchResult {
  score: number;
  reasons: MatchReason[];
}

/** The subset of Item fields the scorer needs. */
export interface MatchableItem {
  id: string;
  itemType: 'LOST' | 'FOUND';
  title: string;
  description: string;
  location: string;
  categoryId?: string | null;
  zoneId?: string | null;
  tags?: readonly string[];
  createdAt: Date;
}

export interface RankedMatch<T extends MatchableItem> {
  item: T;
  score: number;
  reasons: MatchReason[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

/** Weighted, rounded contribution. Reasons therefore sum exactly to the score. */
function contribution(weight: number, ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.round(weight * Math.min(ratio, 1));
}

/**
 * Score the *content* similarity of two reports, ignoring item type.
 *
 * Split out from {@link scoreMatch} because two different questions are asked of
 * the same signals: "do these two complementary reports describe one item?" and
 * "is this new post a duplicate of an existing one?" The second compares reports
 * of the *same* type, so it must not be gated on complementary types.
 */
export function scoreSimilarity(a: MatchableItem, b: MatchableItem): MatchResult {
  if (a.id === b.id) return { score: 0, reasons: [] };

  const reasons: MatchReason[] = [];

  const titleScore = contribution(
    MATCH_WEIGHTS.title,
    jaccard(tokenize(a.title), tokenize(b.title))
  );
  if (titleScore > 0) {
    reasons.push({ code: 'title_overlap', label: 'Similar title', weight: titleScore });
  }

  const descriptionScore = contribution(
    MATCH_WEIGHTS.description,
    jaccard(tokenize(a.description), tokenize(b.description))
  );
  if (descriptionScore > 0) {
    reasons.push({
      code: 'description_overlap',
      label: 'Similar description',
      weight: descriptionScore,
    });
  }

  if (a.categoryId && b.categoryId && a.categoryId === b.categoryId) {
    reasons.push({ code: 'same_category', label: 'Same category', weight: MATCH_WEIGHTS.category });
  }

  // Zone and free-text location are mutually exclusive signals: when both sides
  // carry structured geography the zone is authoritative, and the text is only
  // consulted when at least one side has no zone. This keeps a single report
  // from being credited twice for the same underlying fact.
  if (a.zoneId && b.zoneId) {
    if (a.zoneId === b.zoneId) {
      reasons.push({ code: 'same_zone', label: 'Same campus zone', weight: MATCH_WEIGHTS.zone });
    }
  } else {
    const locationScore = contribution(
      MATCH_WEIGHTS.location,
      jaccard(tokenize(a.location), tokenize(b.location))
    );
    if (locationScore > 0) {
      reasons.push({
        code: 'similar_location',
        label: 'Similar location',
        weight: locationScore,
      });
    }
  }

  const apart = daysBetween(a.createdAt, b.createdAt);
  const dateScore = contribution(MATCH_WEIGHTS.date, 1 - apart / MATCH_WINDOW_DAYS);
  if (dateScore > 0) {
    const rounded = Math.round(apart);
    const when =
      rounded === 0 ? 'Reported the same day' : `Reported ${rounded} day${rounded === 1 ? '' : 's'} apart`;
    reasons.push({ code: 'close_in_time', label: when, weight: dateScore });
  }

  const tagScore = contribution(
    MATCH_WEIGHTS.tags,
    jaccard(a.tags ?? [], b.tags ?? [])
  );
  if (tagScore > 0) {
    reasons.push({ code: 'shared_tags', label: 'Shared tags', weight: tagScore });
  }

  const score = reasons.reduce((total, reason) => total + reason.weight, 0);

  return { score: Math.min(score, 100), reasons };
}

/**
 * Score how likely two reports describe the same physical item.
 *
 * Returns `{ score: 0, reasons: [] }` for same-type pairs: a LOST report can
 * only be reconciled with a FOUND report.
 */
export function scoreMatch(a: MatchableItem, b: MatchableItem): MatchResult {
  if (a.itemType === b.itemType) return { score: 0, reasons: [] };
  return scoreSimilarity(a, b);
}

/**
 * Score `subject` against every candidate and return the strong pairs, best
 * first. Ties break by most-recently-created candidate so results are stable.
 */
export function rankMatches<T extends MatchableItem>(
  subject: MatchableItem,
  candidates: readonly T[],
  threshold: number = MATCH_THRESHOLD
): RankedMatch<T>[] {
  const ranked: RankedMatch<T>[] = [];

  for (const candidate of candidates) {
    if (candidate.id === subject.id) continue;
    const { score, reasons } = scoreMatch(subject, candidate);
    if (score >= threshold) ranked.push({ item: candidate, score, reasons });
  }

  ranked.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return y.item.createdAt.getTime() - x.item.createdAt.getTime();
  });

  return ranked;
}

/** Convenience wrapper for the duplicate-post guard. */
export function findLikelyDuplicates<T extends MatchableItem>(
  subject: MatchableItem,
  candidates: readonly T[]
): RankedMatch<T>[] {
  const scored: RankedMatch<T>[] = [];

  for (const candidate of candidates) {
    // A duplicate is a re-post of the *same* kind of report, so an LOST/FOUND
    // pair is never a duplicate even when the wording is identical.
    if (candidate.itemType !== subject.itemType) continue;
    if (candidate.id === subject.id) continue;

    const { score, reasons } = scoreSimilarity(subject, candidate);
    if (duplicateSimilarity(subject, candidate) >= DUPLICATE_SIMILARITY_THRESHOLD) {
      scored.push({ item: candidate, score, reasons });
    }
  }

  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return y.item.createdAt.getTime() - x.item.createdAt.getTime();
  });

  return scored;
}
