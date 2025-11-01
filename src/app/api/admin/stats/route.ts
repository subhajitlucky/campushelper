import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/stats
 * Get overview statistics for admin dashboard
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

    // Fetch statistics
    const [
      totalUsers,
      totalItems,
      totalClaims,
      pendingClaims,
      activeItems,
      resolvedItems,
      deletedItems
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Total items
      prisma.item.count(),
      
      // Total claims
      prisma.claim.count(),
      
      // Pending claims
      prisma.claim.count({
        where: { status: 'PENDING' }
      }),
      
      // Active items (not deleted)
      prisma.item.count({
        where: { 
          status: { 
            not: 'DELETED' 
          }
        }
      }),
      
      // Resolved items
      prisma.item.count({
        where: { status: 'RESOLVED' }
      }),
      
      // Deleted items
      prisma.item.count({
        where: { status: 'DELETED' }
      })
    ]);

    // Calculate active vs inactive users
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    });

    const stats = {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      totalItems,
      activeItems,
      resolvedItems,
      deletedItems,
      totalClaims,
      pendingClaims,
      resolvedClaims: totalClaims - pendingClaims
    };

    return NextResponse.json(stats);

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
