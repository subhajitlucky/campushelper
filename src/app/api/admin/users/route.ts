import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { limitSchema, pageSchema } from '@/lib/schemas/query';
import type { Prisma, Role } from '@/generated/prisma';

/**
 * GET /api/admin/users
 * Get all users with their stats (admin only)
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
    const parsedPage = pageSchema.safeParse(searchParams.get('page') ?? undefined);
    const parsedLimit = limitSchema(20).safeParse(searchParams.get('limit') ?? undefined);

    if (!parsedPage.success || !parsedLimit.success) {
      return NextResponse.json(
        { error: 'Page must be a whole number and limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    const page = parsedPage.data;
    const limit = parsedLimit.data;
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined; // active/inactive
    const search = searchParams.get('search') || undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};
    
    if (role && ['USER', 'ADMIN', 'MODERATOR'].includes(role)) {
      where.role = role as Role;
    }
    
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          email: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Fetch users with their stats
    const users = await prisma.user.findMany({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            itemsPosted: true, // Items posted by user
            claims: true // Claims made by user
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.user.count({ where });

    // Format users for admin view
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      itemsCount: user._count.itemsPosted,
      claimsCount: user._count.claims
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
