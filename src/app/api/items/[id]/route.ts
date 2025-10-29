import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/items/[id]
 * Fetch a single item by ID with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 72-73: Extract and validate ID from params
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Step 73: Query Prisma.item.findUnique() with relations
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        // Include postedBy user details
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        },
        // Include claimedBy user details if item is claimed
        claimedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          }
        },
        // Include comments with user details
        comments: {
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              }
            }
          }
        },
        // Include claims with user details
        claims: {
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              }
            }
          }
        }
      }
    });

    // Step 73: Return 404 if not found
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Transform data to include counts and restructure for consistency
    const responseItem = {
      ...item,
      commentCount: item.comments.length,
      claimCount: item.claims.length,
      // Structure comments for easier frontend consumption
      comments: item.comments.map(comment => ({
        id: comment.id,
        message: comment.message,
        images: comment.images,
        createdAt: comment.createdAt,
        user: comment.user
      })),
      // Structure claims for easier frontend consumption
      claims: item.claims.map(claim => ({
        id: claim.id,
        claimType: claim.claimType,
        status: claim.status,
        message: claim.message,
        createdAt: claim.createdAt,
        resolvedAt: claim.resolvedAt,
        user: claim.user
      })),
    };

    return NextResponse.json({
      item: responseItem
    });

  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/items/[id]
 * Update item (Steps 74: Implementation ready)
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // TODO: Implement PUT logic in Step 74
    return NextResponse.json(
      { error: 'PUT /api/items/[id] not yet implemented' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/items/[id]
 * Soft delete item (Step 75: Implementation ready)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // TODO: Implement DELETE logic in Step 75
    return NextResponse.json(
      { error: 'DELETE /api/items/[id] not yet implemented' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}
