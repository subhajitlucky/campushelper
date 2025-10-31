import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/admin/items/[id]
 * Admin moderation actions: force delete, flag as spam, unflag
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check admin authorization
    const userRole = session.user.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
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

    const { action } = requestBody;

    if (!action || !['force_delete', 'flag_spam', 'unflag_spam'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (force_delete, flag_spam, unflag_spam)' },
        { status: 400 }
      );
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
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    let updatedItem;
    const adminId = session.user.id;
    const now = new Date();

    try {
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
    } catch (dbError) {
      console.error('Database error during item moderation:', dbError);
      return NextResponse.json(
        { error: 'Failed to perform moderation action' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error during item moderation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
