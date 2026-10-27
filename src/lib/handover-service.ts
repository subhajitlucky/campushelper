import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { prisma } from './prisma';
import { notify } from './notifications';
import { awardReputation } from './reputation-service';
import {
  HANDOVER_CODE_TTL_HOURS,
  MAX_HANDOVER_ATTEMPTS,
} from './schemas/handover';

/**
 * Handover verification.
 *
 * A claim being "approved" only means the poster believes the claimer. The
 * handover code is what proves the item actually changed hands: it is issued at
 * approval, shown by the poster, and entered by the claimer at the moment of
 * handover. Only then is the item marked resolved.
 *
 * The code is a short-lived secret, not a password, so it is compared in
 * constant time (via fixed-length digests) to avoid leaking it digit by digit.
 * Only the poster may read it; only the claimer may verify it. Splitting those
 * rights is what makes the code evidence of a physical exchange rather than a
 * confirmation either party can complete alone.
 */

/** Generate a cryptographically random six-digit code. */
export function generateHandoverCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Constant-time comparison of two codes.
 *
 * Both sides are hashed first so the comparison is over equal-length buffers
 * and short-circuits on length are impossible.
 */
export function handoverCodesMatch(expected: string, provided: string): boolean {
  const expectedDigest = createHash('sha256').update(expected).digest();
  const providedDigest = createHash('sha256').update(provided).digest();

  return timingSafeEqual(expectedDigest, providedDigest);
}

export interface HandoverClaimContext {
  id: string;
  status: string;
  userId: string;
  itemId: string;
  item: { id: string; title: string; postedById: string };
}

/**
 * The parties entitled to view a claim's handover status: the claimer, the
 * item's poster, and moderators. This is access to the status page, not to the
 * code itself: only {@link canViewHandoverCode} may see the secret.
 */
export function canAccessHandover(
  claim: HandoverClaimContext,
  userId: string,
  role: string | undefined
): boolean {
  if (claim.userId === userId) return true;
  if (claim.item.postedById === userId) return true;

  return role === 'ADMIN' || role === 'MODERATOR';
}

/** Only the poster may read the code and show it to the claimer. */
export function canViewHandoverCode(
  claim: HandoverClaimContext,
  userId: string
): boolean {
  return claim.item.postedById === userId;
}

/**
 * Only the claimer may enter the code. The poster showing the code and the
 * claimer entering it is what makes the handover a two-party exchange.
 */
export function canVerifyHandover(
  claim: HandoverClaimContext,
  userId: string
): boolean {
  return claim.userId === userId;
}

/** Re-issuing is the poster's action, because only the poster can read the new code. */
export function canReissueHandover(
  claim: HandoverClaimContext,
  userId: string
): boolean {
  return claim.item.postedById === userId;
}

/** Load a claim with the item facts the handover flow needs. */
export async function loadHandoverClaim(claimId: string) {
  return prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      status: true,
      userId: true,
      itemId: true,
      handoverCode: true,
      handoverCodeExpiresAt: true,
      handoverAttempts: true,
      handoverVerifiedAt: true,
      item: { select: { id: true, title: true, postedById: true } },
    },
  });
}

/**
 * Issue (or re-issue) a handover code for an approved claim.
 *
 * Resets the attempt counter so a re-issue genuinely gives both parties a fresh
 * chance. Returns the plaintext code and its expiry; the caller must only hand
 * the code to the poster, who shows it to the claimer.
 */
export async function issueHandoverCode(
  claimId: string
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateHandoverCode();
  const expiresAt = new Date(Date.now() + HANDOVER_CODE_TTL_HOURS * 60 * 60 * 1000);

  const claim = await prisma.claim.update({
    where: { id: claimId },
    data: {
      handoverCode: code,
      handoverCodeExpiresAt: expiresAt,
      handoverAttempts: 0,
    },
    select: {
      id: true,
      userId: true,
      itemId: true,
      item: { select: { id: true, title: true, postedById: true } },
    },
  });

  // Both parties are told a code exists; only the poster can read it. Each
  // link opens the dashboard tab where that party has an action to take.
  await notify({
    userId: claim.userId,
    type: 'HANDOVER_CODE_ISSUED',
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    link: '/dashboard?tab=claims',
  });

  await notify({
    userId: claim.item.postedById,
    type: 'HANDOVER_CODE_ISSUED',
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    link: '/dashboard?tab=incoming',
  });

  return { code, expiresAt };
}

export type HandoverVerificationResult =
  | { outcome: 'verified'; claimId: string; itemId: string }
  | { outcome: 'mismatch'; attemptsRemaining: number }
  | { outcome: 'exhausted' }
  | { outcome: 'expired' }
  | { outcome: 'invalid_state' };

/**
 * Verify a code and, on success, complete the claim and resolve the item.
 *
 * A wrong code consumes an attempt; the fifth wrong attempt invalidates the
 * code entirely, which stops a six-digit space (a million possibilities) from
 * being brute-forced across many requests.
 */
export async function verifyHandover(
  claimId: string,
  providedCode: string
): Promise<HandoverVerificationResult> {
  const claim = await loadHandoverClaim(claimId);

  if (!claim || claim.status !== 'APPROVED' || !claim.handoverCode) {
    return { outcome: 'invalid_state' };
  }

  if (claim.handoverAttempts >= MAX_HANDOVER_ATTEMPTS) {
    return { outcome: 'exhausted' };
  }

  if (claim.handoverCodeExpiresAt && claim.handoverCodeExpiresAt.getTime() < Date.now()) {
    return { outcome: 'expired' };
  }

  if (!handoverCodesMatch(claim.handoverCode, providedCode)) {
    // Atomic increment: the old read-modify-write let five concurrent attempts
    // all write `1`, so the attempt cap could be bypassed.
    const consumed = await prisma.claim.updateMany({
      where: {
        id: claimId,
        status: 'APPROVED',
        handoverCode: claim.handoverCode,
        handoverAttempts: { lt: MAX_HANDOVER_ATTEMPTS },
      },
      data: { handoverAttempts: { increment: 1 } },
    });

    if (consumed.count === 0) {
      // The claim changed, or the code was exhausted by a concurrent attempt,
      // between the read and the write. Report the state it is actually in.
      const current = await loadHandoverClaim(claimId);

      if (
        current?.status === 'APPROVED' &&
        current.handoverAttempts >= MAX_HANDOVER_ATTEMPTS
      ) {
        return { outcome: 'exhausted' };
      }

      return { outcome: 'invalid_state' };
    }

    const updated = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { handoverAttempts: true },
    });

    const attempts = updated?.handoverAttempts ?? MAX_HANDOVER_ATTEMPTS;
    const exhausted = attempts >= MAX_HANDOVER_ATTEMPTS;

    if (exhausted) {
      // Burn the code once only, even if several attempts crossed the cap
      // together. The conditional update elects a single notifier.
      const burned = await prisma.claim.updateMany({
        where: {
          id: claimId,
          status: 'APPROVED',
          handoverCode: claim.handoverCode,
          handoverAttempts: { gte: MAX_HANDOVER_ATTEMPTS },
        },
        data: { handoverCode: null, handoverCodeExpiresAt: null },
      });

      if (burned.count > 0) {
        // Both parties need to know the code is dead, or they will meet up and
        // find that neither can complete the handover.
        await notify({
          userId: claim.userId,
          type: 'HANDOVER_CODE_INVALIDATED',
          itemId: claim.itemId,
          itemTitle: claim.item.title,
          link: '/dashboard?tab=claims',
        });

        await notify({
          userId: claim.item.postedById,
          type: 'HANDOVER_CODE_INVALIDATED',
          itemId: claim.itemId,
          itemTitle: claim.item.title,
          link: '/dashboard?tab=incoming',
        });
      }

      return { outcome: 'exhausted' };
    }

    return { outcome: 'mismatch', attemptsRemaining: MAX_HANDOVER_ATTEMPTS - attempts };
  }

  const now = new Date();

  const completed = await prisma.$transaction(async (tx) => {
    // Complete only if this exact code is still the active one. Two people
    // submitting the correct code at the same time must not both complete the
    // claim or credit the return twice.
    const claimUpdate = await tx.claim.updateMany({
      where: {
        id: claimId,
        status: 'APPROVED',
        handoverCode: claim.handoverCode,
      },
      data: {
        status: 'COMPLETED',
        handoverVerifiedAt: now,
        completedAt: now,
        resolvedAt: now,
        handoverCode: null,
        handoverCodeExpiresAt: null,
      },
    });

    if (claimUpdate.count === 0) return false;

    await tx.item.update({
      where: { id: claim.itemId },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
        claimedById: claim.userId,
      },
    });

    return true;
  });

  if (!completed) {
    return { outcome: 'invalid_state' };
  }

  // Both sides contributed to a successful return, so both are credited.
  await awardReputation(claim.userId, 'RETURN_COMPLETED', {
    itemId: claim.itemId,
    note: 'Verified handover',
  });

  await awardReputation(claim.item.postedById, 'RETURN_COMPLETED', {
    itemId: claim.itemId,
    note: 'Verified handover',
  });

  await notify({
    userId: claim.userId,
    type: 'HANDOVER_VERIFIED',
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    link: `/item/${claim.itemId}`,
  });

  await notify({
    userId: claim.item.postedById,
    type: 'HANDOVER_VERIFIED',
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    link: `/item/${claim.itemId}`,
  });

  return { outcome: 'verified', claimId, itemId: claim.itemId };
}
