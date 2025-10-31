import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/items
 * Get all items including deleted ones (admin only)
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status && ['LOST', 'FOUND', 'CLAIMED', 'RESOLVED', 'DELETED'].includes(status)) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          location: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Fetch items with admin access (including deleted)
    const items = await prisma.item.findMany({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true
          }
        },
        _count: {
          select: {
            comments: true,
            claims: true
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.item.count({ where });

    // Format items for admin view
    const formattedItems = items.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      itemType: item.itemType,
      location: item.location,
      createdAt: item.createdAt.toISOString(),
      postedBy: item.postedBy,
      claimCount: item._count.claims,
      commentCount: item._count.comments
    }));

    return NextResponse.json({
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching admin items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
