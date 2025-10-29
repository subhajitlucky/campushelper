import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/comments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to delete a comment.' },
        { status: 401 }
      );
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
      console.error('Database error deleting comment:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete comment from database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error deleting comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
