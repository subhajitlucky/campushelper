/**
 * Reputation rules for CampusHelper.
 *
 * Points are awarded through an append-only ledger (`ReputationEvent`) whose
 * unique constraint on `(userId, kind, itemId)` makes every award idempotent, so
 * replaying a lifecycle transition can never double-credit a user. This module
 * holds the rule table and the tier derivation; it performs no I/O.
 */

export type ReputationKind =
  | 'ITEM_POSTED'
  | 'COMMENT_POSTED'
  | 'CLAIM_APPROVED'
  | 'RETURN_COMPLETED'
  | 'MODERATION_UPHELD';

/**
 * Point values per kind.
 *
 * `COMMENT_POSTED` and `MODERATION_UPHELD` are defined here for completeness but
 * are NOT awarded anywhere yet: the comments route does not credit reputation,
 * and bulk moderation does not apply a penalty. Treat them as unwired, and do
 * not describe them as live behaviour until they are actually awarded.
 */
export const REPUTATION_POINTS: Readonly<Record<ReputationKind, number>> = {
  ITEM_POSTED: 2,
  COMMENT_POSTED: 1,
  CLAIM_APPROVED: 5,
  RETURN_COMPLETED: 25,
  /** Negative: intended for a moderator upholding a report against this user. */
  MODERATION_UPHELD: -10,
};

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
