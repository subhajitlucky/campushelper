import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/items
 * Fetch all items with pagination and optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Fetch items with related data
    const items = await prisma.item.findMany({
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        // Include postedBy user details (excluding sensitive data)
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
        // Get count of comments for each item
        comments: {
          select: {
            id: true,
          }
        },
        // Get count of claims for each item
        claims: {
          select: {
            id: true,
          }
        }
      }
    });

    // Transform data to include counts
    const transformedItems = items.map(item => ({
      ...item,
      commentCount: item.comments.length,
      claimCount: item.claims.length,
      // Remove the arrays we only used for counting
      comments: undefined,
      claims: undefined,
    }));

    // Get total count for pagination
    const total = await prisma.item.count();

    return NextResponse.json({
      items: transformedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      }
    });

  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items
 * Create a new item (for future implementation)
 */
export async function POST(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // TODO: Implement POST logic in Step 67
    return NextResponse.json(
      { error: 'POST /api/items not yet implemented' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}
