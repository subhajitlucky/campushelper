import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateClaimStatusSchema } from '@/lib/schemas/claim-update';

// PUT /api/claims/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to update a claim.' },
        { status: 401 }
      );
    }

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
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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

    try {
      const updateData = {
        status,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      };

      // Update claim and potentially item status
      const updatedClaim = await prisma.$transaction(async (tx) => {
        // Update claim status
        const claimUpdate = await tx.claim.update({
          where: { id },
          data: updateData,
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
                email: true,
              },
            },
          },
        });

        // If claim is approved, update item status based on claim type
        if (status === 'APPROVED') {
          // Security fix: Check if item is already claimed by someone else
          const currentItem = await tx.item.findUnique({
            where: { id: claim.itemId },
            select: { 
              status: true, 
              claimedById: true,
              postedById: true 
            }
          });
          
          if (!currentItem) {
            throw new Error('Item not found');
          }
          
          // Prevent claiming an already claimed item (unless it's the same user)
          if (currentItem.claimedById && currentItem.claimedById !== claim.userId) {
            throw new Error('Item has already been claimed by another user');
          }
          
          // Prevent claiming a resolved item
          if (currentItem.status === 'RESOLVED') {
            throw new Error('Item has already been resolved');
          }
          
          const newItemStatus = claim.claimType === 'OWN_IT' ? 'RESOLVED' : 'CLAIMED';
          
          await tx.item.update({
            where: { id: claim.itemId },
            data: { 
              status: newItemStatus,
              resolvedAt: new Date(),
              claimedById: claim.userId 
            },
          });
        }

        return claimUpdate;
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
          email: updatedClaim.user.email,
        },
        item: {
          id: updatedClaim.item.id,
          title: updatedClaim.item.title,
        },
      };

      const statusMessage = status === 'APPROVED' ? 'approved' : 'rejected';
      
      return NextResponse.json({
        claim: responseClaim,
        message: `Claim has been ${statusMessage} successfully`
      });

    } catch (dbError) {
      console.error('Database error updating claim:', dbError);
      return NextResponse.json(
        { error: 'Failed to update claim in database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error updating claim:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
