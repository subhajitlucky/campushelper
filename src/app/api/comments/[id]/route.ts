import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkCSRF } from '@/lib/csrf-middleware';

// DELETE /api/comments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const csrfResult = await checkCSRF(request);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to delete a comment.' },
        { status: 401 }
      );
    }

    if (csrfResult) {
      return csrfResult;
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    // Find comment and check if user is author or admin
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        message: true,
        userId: true,
        itemId: true,
        user: {
          select: { role: true }
        }
      }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const userRole = session.user.role;
    const isOwner = comment.userId === session.user.id;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only delete your own comments or you need admin/moderator permissions' },
        { status: 403 }
      );
    }

    try {
      // Delete the comment
      const deletedComment = await prisma.comment.delete({
        where: { id },
        select: {
          id: true,
          message: true,
          userId: true,
          itemId: true,
          createdAt: true
        }
      });

      return NextResponse.json({
        comment: deletedComment,
        message: `Comment "${comment.message.substring(0, 50)}..." has been successfully deleted`
      });
    } catch (dbError) {
      return NextResponse.json(
        { error: 'Failed to delete comment from database' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/comments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const csrfResult = await checkCSRF(request);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to edit a comment.' },
        { status: 401 }
      );
    }

    if (csrfResult) {
      return csrfResult;
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
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

    const { message } = requestBody;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment message is required' },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'Comment message must be 1000 characters or less' },
        { status: 400 }
      );
    }

    // Find comment and check if user is author
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        message: true,
        userId: true,
        itemId: true,
        createdAt: true,
        item: {
          select: {
            id: true,
            status: true,
            postedById: true
          }
        }
      }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user is comment author
    if (comment.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only edit your own comments' },
        { status: 403 }
      );
    }

    // Check if item is resolved or deleted - no editing allowed
    if (comment.item.status === 'RESOLVED' || comment.item.status === 'DELETED') {
      return NextResponse.json(
        { error: 'Comments cannot be edited after item resolution or deletion' },
        { status: 400 }
      );
    }

    try {
      // Update comment
      const updatedComment = await prisma.comment.update({
        where: { id },
        data: {
          message: message.trim(),
          updatedAt: new Date()
        },
        select: {
          id: true,
          message: true,
          userId: true,
          itemId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return NextResponse.json({
        comment: updatedComment,
        message: 'Comment updated successfully'
      });
    } catch (dbError) {
      return NextResponse.json(
        { error: 'Failed to update comment in database' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
