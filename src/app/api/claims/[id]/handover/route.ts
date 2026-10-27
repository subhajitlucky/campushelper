import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitV2 } from '@/lib/rateLimit';
import {
  AuthenticationRequired,
  ForbiddenError,
  NotFound,
  ErrorCodes,
  createErrorResponse,
  safeApiHandler,
} from '@/lib/errors';
import { handoverActionSchema, MAX_HANDOVER_ATTEMPTS } from '@/lib/schemas/handover';
import {
  canAccessHandover,
  issueHandoverCode,
  loadHandoverClaim,
  verifyHandover,
} from '@/lib/handover-service';

/**
 * GET /api/claims/[id]/handover
 * The handover code and its status, for an entitled party only.
 *
 * The code is never included in the shared item projection: it is readable only
 * here, by the claimer, the item's poster, or a moderator.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeApiHandler(async () => {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    const claim = await loadHandoverClaim(id);
    if (!claim) {
      throw NotFound('Claim');
    }

    const context = {
      id: claim.id,
      status: claim.status,
      userId: claim.userId,
      itemId: claim.itemId,
      item: claim.item,
    };

    if (!canAccessHandover(context, session.user.id, session.user.role)) {
      throw ForbiddenError('Only the parties to this claim can view its handover code.');
    }

    const expired =
      !!claim.handoverCodeExpiresAt && claim.handoverCodeExpiresAt.getTime() < Date.now();
    const exhausted = claim.handoverAttempts >= MAX_HANDOVER_ATTEMPTS;

    return NextResponse.json({
      handover: {
        status: claim.status,
        code: claim.handoverCode,
        expiresAt: claim.handoverCodeExpiresAt?.toISOString() ?? null,
        verifiedAt: claim.handoverVerifiedAt?.toISOString() ?? null,
        attemptsRemaining: Math.max(MAX_HANDOVER_ATTEMPTS - claim.handoverAttempts, 0),
        expired,
        exhausted,
        isClaimer: claim.userId === session.user.id,
        isPoster: claim.item.postedById === session.user.id,
      },
    });
  });
}

/**
 * POST /api/claims/[id]/handover
 * Verify a code, or re-issue one.
 *
 * Either party may verify: whoever physically receives the item enters the code
 * the other read out. Re-issuing is likewise open to both, because either side
 * may need to recover from an expired or exhausted code.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeApiHandler(async () => {
    const csrfCheck = await checkCSRF(request);
    if (csrfCheck) {
      return csrfCheck;
    }

    const { id } = await params;

    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    await limitV2('handover', session.user.id);

    const claim = await loadHandoverClaim(id);
    if (!claim) {
      throw NotFound('Claim');
    }

    const context = {
      id: claim.id,
      status: claim.status,
      userId: claim.userId,
      itemId: claim.itemId,
      item: claim.item,
    };

    if (!canAccessHandover(context, session.user.id, session.user.role)) {
      throw ForbiddenError('Only the parties to this claim can complete this handover.');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        'Invalid JSON in request body',
        ErrorCodes.BAD_REQUEST,
        400
      );
    }

    const parsed = handoverActionSchema.parse(body);

    // Re-issue path.
    if ('reissue' in parsed) {
      if (claim.status !== 'APPROVED') {
        return createErrorResponse(
          'A handover code can only be issued for an approved claim.',
          ErrorCodes.INVALID_ITEM_STATUS,
          400
        );
      }

      const { code, expiresAt } = await issueHandoverCode(id);

      return NextResponse.json({
        handover: { code, expiresAt: expiresAt.toISOString(), reissued: true },
        message: 'A new handover code has been issued to both parties.',
      });
    }

    // Verification path.
    const result = await verifyHandover(id, parsed.code);

    switch (result.outcome) {
      case 'verified':
        return NextResponse.json({
          verified: true,
          itemId: result.itemId,
          message:
            'Handover verified. The item is now marked as returned to its owner.',
        });

      case 'mismatch':
        return createErrorResponse(
          'That handover code is not correct.',
          ErrorCodes.INVALID_HANDOVER_CODE,
          400,
          { attemptsRemaining: result.attemptsRemaining }
        );

      case 'exhausted':
        return createErrorResponse(
          'Too many incorrect attempts. The code has been invalidated — ask the other party to re-issue one.',
          ErrorCodes.HANDOVER_ATTEMPTS_EXHAUSTED,
          400
        );

      case 'expired':
        return createErrorResponse(
          'This handover code has expired. Re-issue one to continue.',
          ErrorCodes.HANDOVER_CODE_EXPIRED,
          400
        );

      case 'invalid_state':
      default:
        return createErrorResponse(
          'This claim is not awaiting a handover.',
          ErrorCodes.INVALID_ITEM_STATUS,
          400
        );
    }
  });
}
