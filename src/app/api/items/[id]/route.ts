import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateItemSchema } from '@/lib/schemas/item';
import { sanitizeInput } from '@/lib/security';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitCustom } from '@/lib/rateLimit';

/**
 * GET /api/items/[id]
 * Fetch a single item by ID with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get session (optional - unauthenticated users can view items)
    const session = await getSession();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;

    // Extract and validate ID from params
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Basic ID validation
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json(
        { error: 'Invalid item ID format' },
        { status: 400 }
      );
    }

    // Query the item
    const item = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        postedById: true,
        claimedById: true,
        status: true,
        itemType: true,
      }
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Determine authorization level
    const isOwner = userId === item.postedById;
    const isClaimant = userId === item.claimedById;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
    const canSeeUserData = !!(userId && (isOwner || isAdmin || isClaimant));

    // Query with OPTIMAL SELECT based on authorization
    const itemData = await prisma.item.findUnique({
      where: { id },
      select: {
        // Always include these fields
        id: true,
        title: true,
        description: true,
        itemType: true,
        status: true,
        location: true,
        images: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,

        // User data - include ONLY if authorized
        ...(canSeeUserData && {
          postedBy: {
            select: {
              id: true,
              name: true,
              // Email ONLY for owner/admin
              ...(isOwner || isAdmin ? { email: true } : {}),
              avatar: true,
            }
          },
          claimedBy: {
            select: {
              id: true,
              name: true,
              // Email ONLY for owner/admin
              ...(isOwner || isAdmin ? { email: true } : {}),
              avatar: true,
            }
          }
        }),

        // Claims/comments - ONLY for owner/admin
        ...(userId && (isOwner || isAdmin) && {
          claims: {
            select: {
              id: true,
              claimType: true,
              message: true,
              status: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  // DON'T show claimant email to owner (privacy)
                  ...(isAdmin ? { email: true } : {}),
                  avatar: true,
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          comments: {
            select: {
              id: true,
              message: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }),
      }
    });

    // Process name truncation for non-owners
    if (itemData?.postedBy && userId && !isOwner && !isAdmin) {
      const name = itemData.postedBy.name || '';
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        itemData.postedBy.name = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
      }

      // Remove email from non-owners
      delete (itemData.postedBy as any).email;
    }

    return NextResponse.json(itemData);
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    // Step 74: Check authentication and CSRF
    const session = await getSession();
    const csrfResult = await checkCSRF(request);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (csrfResult) {
      return csrfResult;
    }

    // Rate limiting: 20 item updates per hour per user
    await limitCustom(`items:update:${session.user.id}`, 20, 3600, 'item update');

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
    // Step 75: Check authentication and CSRF
    const session = await getSession();
    const csrfResult = await checkCSRF(request);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to delete an item.' },
        { status: 401 }
      );
    }

    if (csrfResult) {
      return csrfResult;
    }

    // Rate limiting: 10 item deletions per hour per user
    await limitCustom(`items:delete:${session.user.id}`, 10, 3600, 'item delete');

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
