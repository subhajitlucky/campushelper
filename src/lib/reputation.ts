/**
 * Reputation rules for CampusHelper.
 *
 * Points are awarded through an append-only ledger (`ReputationEvent`) whose
 * unique constraint on `(userId, kind, itemId)` makes every award idempotent, so
 * replaying a lifecycle transition can never double-credit a user. This module
 * holds the rule table and the derivations; it performs no I/O.
 */

export type ReputationKind =
  | 'ITEM_POSTED'
  | 'COMMENT_POSTED'
  | 'CLAIM_APPROVED'
  | 'RETURN_COMPLETED'
  | 'MODERATION_UPHELD';

export const REPUTATION_POINTS: Readonly<Record<ReputationKind, number>> = {
  ITEM_POSTED: 2,
  COMMENT_POSTED: 1,
  CLAIM_APPROVED: 5,
  RETURN_COMPLETED: 25,
  /** Negative: a moderator upheld a report against this user's content. */
  MODERATION_UPHELD: -10,
};

/** Comments only earn credit up to this many times per user per day. */
export const COMMENT_DAILY_CAP = 10;

export interface ReputationTier {
  name: string;
  /** Inclusive lower bound. */
  min: number;
  /** lucide-react icon name for the badge. */
  icon: string;
  /** Tailwind classes for the badge. */
  className: string;
}

export const TIERS: readonly ReputationTier[] = [
  { name: 'Newcomer', min: 0, icon: 'Sprout', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  { name: 'Bronze', min: 25, icon: 'Shield', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  { name: 'Silver', min: 75, icon: 'ShieldCheck', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  { name: 'Gold', min: 200, icon: 'Award', className: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
  { name: 'Champion', min: 500, icon: 'Trophy', className: 'bg-blue-50 text-blue-800 border-blue-300' },
];

/**
 * Coerce an arbitrary numeric total into a comparable value.
 *
 * `NaN` and negative infinity are treated as zero, while positive infinity maps
 * to the largest safe integer so an unbounded total reads as the *top* tier
 * rather than collapsing to the bottom one.
 */
function toSafeTotal(total: number): number {
  if (Number.isNaN(total)) return 0;
  if (total === Number.POSITIVE_INFINITY) return Number.MAX_SAFE_INTEGER;
  if (total === Number.NEGATIVE_INFINITY) return 0;
  return total;
}

/**
 * The tier a total falls into. Negative totals clamp to the lowest tier.
 */
export function reputationTier(total: number): ReputationTier {
  const safe = toSafeTotal(total);

  let current = TIERS[0];
  for (const tier of TIERS) {
    if (safe >= tier.min) current = tier;
  }

  return current;
}

/**
 * The next tier above `total`, or `null` at the top tier.
 */
export function nextTier(total: number): ReputationTier | null {
  const current = reputationTier(total);
  const index = TIERS.indexOf(current);
  return TIERS[index + 1] ?? null;
}

/**
 * Progress toward the next tier as a fraction in `[0, 1]`.
 *
 * Returns 1 at the top tier so progress bars render full rather than empty.
 */
export function tierProgress(total: number): number {
  const safe = Math.max(toSafeTotal(total), 0);
  const next = nextTier(safe);
  if (!next) return 1;

  const current = reputationTier(safe);
  const span = next.min - current.min;
  if (span <= 0) return 1;

  return Math.min(Math.max((safe - current.min) / span, 0), 1);
}

/**
 * Whether another comment may be credited today, given how many have already
 * been credited. Prevents farming reputation with one-word replies.
 */
export function canCreditComment(commentsCreditedToday: number): boolean {
  const credited = Number.isFinite(commentsCreditedToday) ? commentsCreditedToday : 0;
  return credited < COMMENT_DAILY_CAP;
}

/**
 * Human-readable points delta, e.g. `'+25'` / `'−10'` (a real minus sign, so it
 * reads correctly next to the ASCII hyphen used in prose).
 */
export function formatReputationDelta(points: number): string {
  const safe = Number.isFinite(points) ? Math.round(points) : 0;
  if (safe === 0) return '0';
  return safe > 0 ? `+${safe}` : `−${Math.abs(safe)}`;
}

/**
 * The point value to award, applying the daily comment cap.
 *
 * Returns 0 when no credit is due, so callers can skip the ledger write.
 */
export function resolveAward(kind: ReputationKind, commentsCreditedToday = 0): number {
  if (kind === 'COMMENT_POSTED' && !canCreditComment(commentsCreditedToday)) return 0;
  return REPUTATION_POINTS[kind];
}
