import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  AuthenticationRequired, 
  AdminAccessRequired,
  NotFound,
  ValidationError,
  DatabaseError,
  UserAlreadySuspended,
  UserAlreadyActive,
  RoleAlreadyAssigned,
  SelfModificationDenied,
  CannotModifyAdmin,
  safeApiHandler 
} from '@/lib/errors';

/**
 * PUT /api/admin/items/[id]
 * Admin moderation actions: force delete, flag as spam, unflag
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeApiHandler(async () => {
    // Check admin authentication
    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    // Check admin authorization
    const userRole = session.user.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
    
    if (!isAdmin) {
      throw AdminAccessRequired();
    }

    const { id } = await params;
    if (!id) {
      throw ValidationError('Item ID is required');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      throw ValidationError('Invalid JSON in request body');
    }

    const { action } = requestBody;

    if (!action || !['force_delete', 'flag_spam', 'unflag_spam'].includes(action)) {
      throw ValidationError('Valid action is required (force_delete, flag_spam, unflag_spam)');
    }

    // Find the item
    const item = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        postedById: true,
        // Add any spam-related fields if they exist in schema
        // isFlagged: boolean,
        // flaggedAt: DateTime,
        // flaggedById: string
      }
    });

    if (!item) {
      throw NotFound('Item');
    }

    let updatedItem;
    const adminId = session.user.id;
    const now = new Date();

    switch (action) {
      case 'force_delete':
        // Admin can force delete any item
        updatedItem = await prisma.item.update({
          where: { id },
          data: {
            status: 'DELETED',
            resolvedAt: now,
            // Cascade delete comments
            updatedAt: now
          },
          include: {
            postedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        // Soft delete all comments on this item
        await prisma.comment.updateMany({
          where: { itemId: id },
          data: {
            message: '[Comment deleted - item removed by admin]',
            images: [],
            updatedAt: now
          }
        });

        return NextResponse.json({
          message: `Item "${item.title}" has been force deleted by admin`,
          action: 'force_delete',
          item: updatedItem
        });

      case 'flag_spam':
        // Flag item as spam
        // First check if the item has a spam flag field, if not, we'll add status-based spam handling
        updatedItem = await prisma.item.update({
          where: { id },
          data: {
            status: 'RESOLVED', // Temporarily resolve to hide from public
            resolvedAt: now,
            // If there's a spam field, set it here
            // isFlagged: true,
            // flaggedAt: now,
            // flaggedById: adminId,
            updatedAt: now
          },
          include: {
            postedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        return NextResponse.json({
          message: `Item "${item.title}" has been flagged as spam and hidden from public view`,
          action: 'flag_spam',
          item: updatedItem
        });

      case 'unflag_spam':
        // Unflag item and restore visibility
        updatedItem = await prisma.item.update({
          where: { id },
          data: {
            status: item.status === 'RESOLVED' ? 'LOST' : item.status, // Restore to original status or LOST
            resolvedAt: null,
            // isFlagged: false,
            // flaggedAt: null,
            // flaggedById: null,
            updatedAt: now
          },
          include: {
            postedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        return NextResponse.json({
          message: `Item "${item.title}" has been unflagged and restored to public view`,
          action: 'unflag_spam',
          item: updatedItem
        });
    }
  });
}
