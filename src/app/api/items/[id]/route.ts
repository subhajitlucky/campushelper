import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateItemSchema } from '@/lib/schemas/item';
import { sanitizeInput } from '@/lib/security';

/**
 * GET /api/items/[id]
 * Fetch a single item by ID with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CRITICAL FIX: Require authentication to prevent data harvesting
    const session = await getSession();
    const isAuthenticated = !!session?.user?.id;
    
    // Step 72-73: Extract and validate ID from params
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Step 73: Query Prisma.item.findUnique() - basic data only for security
    const item = await prisma.item.findUnique({
      where: { id },
      // SECURITY FIX: Remove user data from initial query
      // User data will be added conditionally based on authorization
    });

    // Step 73: Return 404 if not found
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // SECURITY FIX: Determine if user should see user data
    const canSeeUserData = isAuthenticated && (
      item.postedById === session.user.id || 
      item.claimedById === session.user.id ||
      session.user.role === 'ADMIN' ||
      session.user.role === 'MODERATOR'
    );

    let responseItem;

    if (canSeeUserData) {
      // Authorized user - fetch with user data
      const itemWithUserData = await prisma.item.findUnique({
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

      // Transform data with user data included
      if (itemWithUserData) {
        responseItem = {
          ...itemWithUserData,
          commentCount: itemWithUserData.comments.length,
          claimCount: itemWithUserData.claims.length,
          // Structure comments for easier frontend consumption
          comments: itemWithUserData.comments.map(comment => ({
            id: comment.id,
            message: comment.message,
            images: comment.images,
            createdAt: comment.createdAt,
            user: comment.user
          })),
          // Structure claims for easier frontend consumption
          claims: itemWithUserData.claims.map(claim => ({
            id: claim.id,
            claimType: claim.claimType,
            status: claim.status,
            message: claim.message,
            createdAt: claim.createdAt,
            resolvedAt: claim.resolvedAt,
            user: claim.user
          })),
        };
      } else {
        // Fallback to basic data if user data fetch fails
        responseItem = {
          ...item,
          commentCount: 0,
          claimCount: 0,
          comments: [],
          claims: [],
        };
      }
    } else {
      // Public/unauthorized - basic item data only, no user information
      responseItem = {
        ...item,
        commentCount: 0, // Can't show counts without fetching related data
        claimCount: 0,   // Can't show counts without fetching related data
        comments: [],    // No comments without user data
        claims: [],      // No claims without user data
      };
    }

    return NextResponse.json({
      item: responseItem
    });

  } catch (error) {
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
    const session = await getSession();
    
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
      // Prepare update data with sanitized input
      const updateData: {
        title?: string;
        description?: string;
        itemType?: 'LOST' | 'FOUND';
        status?: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED';
        location?: string;
        images?: string[];
      } = {
        title: validatedData.title ? sanitizeInput(validatedData.title) : undefined,
        description: validatedData.description ? sanitizeInput(validatedData.description) : undefined,
        itemType: validatedData.itemType,
        location: validatedData.location ? sanitizeInput(validatedData.location) : undefined,
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
      return NextResponse.json(
        { error: 'Failed to update item in database' },
        { status: 500 }
      );
    }

  } catch (error) {
    // Step 74: General error handling
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating the item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/items/[id]
 * Soft delete item (Step 75: Complete implementation)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 75: Check authentication
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to delete an item.' },
        { status: 401 }
      );
    }

    // Step 75: Extract and validate ID from params
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Step 75: Verify user is item owner or admin/moderator
    const existingItem = await prisma.item.findUnique({
      where: { id },
      select: { 
        postedById: true, 
        status: true,
        title: true,
        postedBy: { select: { role: true } } 
      }
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Step 75: Check if item is already deleted
    if (existingItem.status === 'DELETED') {
      return NextResponse.json(
        { error: 'Item is already deleted' },
        { status: 400 }
      );
    }

    // Authorization check: owner or admin/moderator
    const userRole = session.user.role;
    const isOwner = existingItem.postedById === session.user.id;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only delete items you own or you need admin/moderator permissions' },
        { status: 403 }
      );
    }

    // Step 75: Soft delete by setting status to DELETED
    try {
      // First, soft-delete all comments for this item (cascade delete)
      await prisma.comment.updateMany({
        where: { itemId: id },
        data: {
          message: '[Comment deleted - item removed]',
          images: [], // Clear images too
          updatedAt: new Date()
        }
      });

      // Then soft-delete the item
      const deletedItem = await prisma.item.update({
        where: { id },
        data: {
          status: 'DELETED',
          resolvedAt: new Date()
        },
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
        ...deletedItem,
        commentCount: deletedItem.comments.length,
        claimCount: deletedItem.claims.length,
        // Remove the arrays we only used for counting
        comments: undefined,
        claims: undefined,
      };

      return NextResponse.json({
        item: responseItem,
        message: `Item "${existingItem.title}" has been successfully resolved`
      });

    } catch (dbError) {
      return NextResponse.json(
        { error: 'Failed to delete item in database' },
        { status: 500 }
      );
    }

  } catch (error) {
    // Step 75: General error handling
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting the item' },
      { status: 500 }
    );
  }
}
