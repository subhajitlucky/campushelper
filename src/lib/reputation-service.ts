import { prisma } from './prisma';
import { resolveAward, type ReputationKind } from './reputation';
import type { ReputationKind as PrismaReputationKind } from '../generated/prisma';

/**
 * Writes reputation to the append-only ledger and keeps the denormalised
 * `User.reputation` total in step.
 *
 * Idempotency comes from the ledger's unique constraint on
 * `(userId, kind, itemId)`: awarding `RETURN_COMPLETED` twice for the same item
 * credits the user once. The counter increment happens in the same transaction
 * as the ledger insert, so the two can never disagree.
 */

export interface AwardOptions {
  /** Scopes idempotency. Omit only for awards that are not item-scoped. */
  itemId?: string | null;
  note?: string | null;
  /**
   * How many comments this user has already been credited for today. Only
   * consulted for `COMMENT_POSTED`.
   */
  commentsCreditedToday?: number;
}

/**
 * Award reputation. Returns the points actually credited (0 when the award was
 * idempotently skipped or capped).
 *
 * Never throws: reputation is a side effect of an action that has already
 * succeeded, so a failure here must not fail the caller's request.
 */
export async function awardReputation(
  userId: string,
  kind: ReputationKind,
  options: AwardOptions = {}
): Promise<number> {
  const points = resolveAward(kind, options.commentsCreditedToday ?? 0);

  if (points === 0) return 0;

  const itemId = options.itemId ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.reputationEvent.create({
        data: {
          userId,
          kind,
          points,
          itemId,
          note: options.note ?? null,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { reputation: { increment: points } },
      });
    });

    return points;
  } catch (error) {
    // P2002 is the unique-constraint violation that makes replays no-ops.
    if (isUniqueConstraintError(error)) return 0;

    console.error('[reputation] failed to award reputation', {
      userId,
      kind,
      points,
      error,
    });
    return 0;
  }
}

/**
 * Award the same kind to several users (for example both parties to a completed
 * return). Returns a map of user id to credited points.
 */
export async function awardReputationMany(
  userIds: readonly string[],
  kind: ReputationKind,
  options: AwardOptions = {}
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  for (const userId of [...new Set(userIds)]) {
    results[userId] = await awardReputation(userId, kind, options);
  }

  return results;
}

/**
 * Count how many comments a user has been credited for since UTC midnight.
 * Used to enforce the daily comment cap.
 */
export async function countCommentsCreditedToday(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  try {
    return await prisma.reputationEvent.count({
      where: {
        userId,
        kind: 'COMMENT_POSTED' as PrismaReputationKind,
        createdAt: { gte: startOfDay },
      },
    });
  } catch (error) {
    console.error('[reputation] failed to count today\'s comment credits', error);
    // Fail closed: do not hand out credit we cannot account for.
    return Number.MAX_SAFE_INTEGER;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
