import { prisma } from './prisma';
import { REPUTATION_POINTS, type ReputationKind } from './reputation';

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
}

/**
 * Award reputation. Returns the points actually credited (0 when the award was
 * idempotently skipped).
 *
 * Never throws: reputation is a side effect of an action that has already
 * succeeded, so a failure here must not fail the caller's request.
 */
export async function awardReputation(
  userId: string,
  kind: ReputationKind,
  options: AwardOptions = {}
): Promise<number> {
  const points = REPUTATION_POINTS[kind];

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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
