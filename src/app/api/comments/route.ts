import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createCommentSchema,
  commentsQuerySchema
} from '@/lib/schemas/comment';
import { sanitizeInput } from '@/lib/security';
import { limitComments } from '@/lib/rateLimit';
import { checkCSRF } from '@/lib/csrf-middleware';

// GET /api/comments?itemId=xxx
export async function GET(request: NextRequest) {
  try {
    // CRITICAL FIX: Require authentication to prevent comments data harvesting
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required to access comments' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let queryParams;
    
    try {
      const paramsObject = Object.fromEntries(searchParams.entries());
      queryParams = commentsQuerySchema.parse(paramsObject);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.message
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { itemId } = queryParams;

    // SECURITY FIX: Check if user has access to this item's comments
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { 
        id: true, 
        postedById: true,
        status: true // Check if item is deleted
      }
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check if user can access comments on this item
    const canAccessComments = 
      // Item owner can see comments
      item.postedById === session.user.id ||
      // Admin/moderator can see all comments
      session.user.role === 'ADMIN' || 
      session.user.role === 'MODERATOR';

    if (!canAccessComments) {
      return NextResponse.json(
        { error: 'You do not have permission to view comments on this item' },
        { status: 403 }
      );
    }

    // Fetch comments for the item with user data
    const comments = await prisma.comment.findMany({
      where: { itemId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        item: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first
    });

    // Transform comments to match response schema
    const transformedComments = comments.map(comment => ({
      id: comment.id,
      message: comment.message,
      images: comment.images,
      itemId: comment.itemId,
      userId: comment.userId,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      user: {
        id: comment.user.id,
        name: comment.user.name,
        email: comment.user.email,
        avatar: comment.user.avatar,
      },
      item: {
        id: comment.item.id,
        title: comment.item.title,
      },
    }));

    const response = {
      comments: transformedComments,
      total: comments.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/comments
export async function POST(request: NextRequest) {
  try {
    // Check CSRF protection first
    const csrfError = await checkCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Check authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to comment.' },
        { status: 401 }
      );
    }

    // Apply rate limiting: 30 comments per hour per user
    await limitComments(request, session.user.id);

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
      validatedData = createCommentSchema.parse(requestBody);
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

    const { message: rawMessage, itemId, images = [] } = validatedData;
    
    // Sanitize user input
    const message = sanitizeInput(rawMessage);

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, status: true }
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Check if item is deleted
    if (item.status === 'DELETED') {
      return NextResponse.json(
        { error: 'Cannot comment on deleted item' },
        { status: 400 }
      );
    }

    try {
      // Create comment in database
      const newComment = await prisma.comment.create({
        data: {
          message,
          itemId,
          userId: session.user.id,
          images: images.filter(image => image && image.trim() !== '') as string[],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          item: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Transform comment to match response schema
      const responseComment = {
        id: newComment.id,
        message: newComment.message,
        images: newComment.images,
        itemId: newComment.itemId,
        userId: newComment.userId,
        createdAt: newComment.createdAt.toISOString(),
        updatedAt: newComment.updatedAt.toISOString(),
        user: {
          id: newComment.user.id,
          name: newComment.user.name,
          email: newComment.user.email,
          avatar: newComment.user.avatar,
        },
        item: {
          id: newComment.item.id,
          title: newComment.item.title,
        },
      };

      return NextResponse.json(
        { comment: responseComment, message: 'Comment created successfully' },
        { status: 201 }
      );
    } catch (dbError) {
      return NextResponse.json(
        { error: 'Failed to create comment in database' },
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
