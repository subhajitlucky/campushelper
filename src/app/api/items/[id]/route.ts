import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateItemSchema } from '@/lib/schemas/item';

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
 * Update item (Step 74: Complete implementation)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 74: Check authentication
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to update an item.' },
        { status: 401 }
      );
    }

    // Step 74: Extract and validate ID from params
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Step 74: Verify user is item owner or admin/moderator
    const existingItem = await prisma.item.findUnique({
      where: { id },
      select: { postedById: true, postedBy: { select: { role: true } } }
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Authorization check: owner or admin/moderator
    const userRole = session.user.role;
    const isOwner = existingItem.postedById === session.user.id;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only update items you own or you need admin/moderator permissions' },
        { status: 403 }
      );
    }

    // Step 74: Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Step 74: Validate with Zod update schema
    let validatedData;
    try {
      validatedData = updateItemSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { 
            error: 'Validation failed',
            details: error.message 
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Step 74: Update item in database
    try {
      // Prepare update data with proper type handling
      const updateData: {
        title?: string;
        description?: string;
        itemType?: 'LOST' | 'FOUND';
        status?: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED';
        location?: string;
        images?: string[];
      } = {
        title: validatedData.title,
        description: validatedData.description,
        itemType: validatedData.itemType,
        location: validatedData.location,
        images: validatedData.images?.filter(image => image && image.trim() !== '') as string[],
      };
      
      // Set status based on itemType if provided
      if (validatedData.itemType) {
        updateData.status = validatedData.itemType === 'LOST' ? 'LOST' : 'FOUND';
      }

      // Update the item
      const updatedItem = await prisma.item.update({
        where: { id },
        data: updateData,
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
          // Include comments and claims counts
          comments: {
            select: {
              id: true,
            }
          },
          claims: {
            select: {
              id: true,
            }
          }
        }
      });

      // Transform response to include counts
      const responseItem = {
        ...updatedItem,
        commentCount: updatedItem.comments.length,
        claimCount: updatedItem.claims.length,
        // Remove the arrays we only used for counting
        comments: undefined,
        claims: undefined,
      };

      return NextResponse.json({
        item: responseItem,
        message: 'Item updated successfully'
      });

    } catch (dbError) {
      console.error('Database error updating item:', dbError);
      return NextResponse.json(
        { error: 'Failed to update item in database' },
        { status: 500 }
      );
    }

  } catch (error) {
    // Step 74: General error handling
    console.error('Unexpected error updating item:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating the item' },
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
    const { id: _id } = await params;
    
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
