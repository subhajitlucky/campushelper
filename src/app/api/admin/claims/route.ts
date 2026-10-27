import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { limitSchema, pageSchema } from '@/lib/schemas/query';
import type { Prisma, ClaimStatus, ClaimType } from '@/generated/prisma';

/**
 * GET /api/admin/claims
 * Get all claims with their associated data (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSession();
    if (!session || !session.user?.id) {
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
    const status = searchParams.get('status') || undefined;
    const claimType = searchParams.get('claimType') || undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ClaimWhereInput = {};
    
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status as ClaimStatus;
    }
    
    if (claimType && ['FOUND_IT', 'OWN_IT'].includes(claimType)) {
      where.claimType = claimType as ClaimType;
    }

    // Fetch claims with their associated data
    const claims = await prisma.claim.findMany({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        item: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.claim.count({ where });

    // Format claims for admin view
    const formattedClaims = claims.map(claim => ({
      id: claim.id,
      claimType: claim.claimType,
      status: claim.status,
      message: claim.message,
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt?.toISOString(),
      resolvedAt: claim.resolvedAt?.toISOString(),
      user: claim.user,
      item: claim.item
    }));

    return NextResponse.json({
      claims: formattedClaims,
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
