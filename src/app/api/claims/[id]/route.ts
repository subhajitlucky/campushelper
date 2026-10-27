import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateClaimStatusSchema } from '@/lib/schemas/claim-update';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitCustom } from '@/lib/rateLimit';
import { issueHandoverCode } from '@/lib/handover-service';
import { notify } from '@/lib/notifications';
import { awardReputation } from '@/lib/reputation-service';

/** Internal signal that an approval lost a race; rolls back the transaction. */
class ClaimConflictError extends Error {}

// PUT /api/claims/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const csrfResult = await checkCSRF(request);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to update a claim.' },
        { status: 401 }
      );
    }

    if (csrfResult) {
      return csrfResult;
    }

    // Rate limiting: 10 claim updates per hour per user
    await limitCustom(`claims:update:${session.user.id}`, 10, 3600, 'claim update');

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request data
    let validatedData;
    try {
      validatedData = updateClaimStatusSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          {
            error: 'Invalid request data',
            details: error.message
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { status } = validatedData;

    // Find claim and verify user is item poster or admin
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        item: {
          select: {
            id: true,
            title: true,
            status: true,
            postedById: true,
            claimedById: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            // Email intentionally excluded (security fix)
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const userRole = session.user.role;
    const isItemOwner = claim.item.postedById === session.user.id;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';

    if (!isItemOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only update claims on your own items or you need admin/moderator permissions' },
        { status: 403 }
      );
    }

    // Check if claim is already resolved
    if (claim.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Claim has already been resolved' },
        { status: 400 }
      );
    }

    // Give a clear conflict before the transaction. The transaction repeats
    // these conditions atomically below, so a concurrent approval cannot slip
    // through between this check and the write.
    if (status === 'APPROVED') {
      if (claim.item.status === 'DELETED' || claim.item.status === 'RESOLVED') {
        return NextResponse.json(
          { error: 'This item is no longer open to a claim.' },
          { status: 409 }
        );
      }

      if (claim.item.status === 'CLAIMED' || claim.item.claimedById) {
        return NextResponse.json(
          { error: 'This item has already been claimed.' },
          { status: 409 }
        );
      }
    }

    try {
      const updatedClaim = await prisma.$transaction(async (tx) => {
        // Conditional on PENDING so two concurrent updates cannot both win.
        const claimUpdate = await tx.claim.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status,
            resolvedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        if (claimUpdate.count === 0) {
          throw new ClaimConflictError('This claim has already been processed.');
        }

        // If claim is approved, mark the item claimed. A conditional update
        // makes "the item is still open and unclaimed" part of the write.
        if (status === 'APPROVED') {
          const itemUpdate = await tx.item.updateMany({
            where: {
              id: claim.itemId,
              status: { in: ['LOST', 'FOUND'] },
              OR: [{ claimedById: null }, { claimedById: claim.userId }],
            },
            data: {
              status: 'CLAIMED',
              claimedById: claim.userId,
            },
          });

          if (itemUpdate.count === 0) {
            throw new ClaimConflictError(
              'This item has already been claimed or resolved.'
            );
          }

          // Approval means "the poster believes this claim", NOT "the item was
          // returned". Only verifyHandover() may set RESOLVED, once the code
          // has been exchanged in person.
        }

        return tx.claim.findUniqueOrThrow({
          where: { id },
          include: {
            item: {
              select: {
                id: true,
                title: true,
                status: true,
                postedById: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                // Email intentionally excluded (security fix)
              },
            },
          },
        });
      });

      // Transform response
      const responseClaim = {
        id: updatedClaim.id,
        claimType: updatedClaim.claimType,
        status: updatedClaim.status,
        message: updatedClaim.message,
        itemId: updatedClaim.itemId,
        userId: updatedClaim.userId,
        createdAt: updatedClaim.createdAt.toISOString(),
        updatedAt: updatedClaim.updatedAt.toISOString(),
        resolvedAt: updatedClaim.resolvedAt?.toISOString() || null,
        user: {
          id: updatedClaim.user.id,
          name: updatedClaim.user.name,
          avatar: updatedClaim.user.avatar,
          // Email intentionally excluded from response (security fix)
        },
        item: {
          id: updatedClaim.item.id,
          title: updatedClaim.item.title,
        },
      };

      const statusMessage = status === 'APPROVED' ? 'approved' : 'rejected';

      // Side effects. The claim is already updated, so none of these may fail
      // the request; each helper swallows and logs its own errors.
      if (status === 'APPROVED') {
        // Issue the proof-of-handover code that gates marking the item resolved.
        // If this fails the approval still stands and either party can reissue
        // the code from the handover panel.
        try {
          await issueHandoverCode(id);
        } catch (error) {
          console.error('[claims] failed to issue handover code after approval', {
            claimId: id,
            error,
          });
        }

        await awardReputation(updatedClaim.userId, 'CLAIM_APPROVED', {
          itemId: claim.itemId,
        });
      }

      await notify({
        userId: updatedClaim.userId,
        type: 'CLAIM_STATUS_CHANGED',
        status,
        actorId: session.user.id,
        itemId: claim.itemId,
        itemTitle: claim.item.title,
        link: `/item/${claim.itemId}`,
      });

      return NextResponse.json({
        claim: responseClaim,
        message: `Claim has been ${statusMessage} successfully`
      });

    } catch (error) {
      if (error instanceof ClaimConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      console.error('[claims] failed to update claim', { claimId: id, error });
      return NextResponse.json(
        { error: 'Failed to update claim in database' },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
