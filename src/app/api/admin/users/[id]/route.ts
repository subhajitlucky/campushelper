import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/admin/users/[id]
 * Admin user moderation actions: suspend, activate, change role
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
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent admin from modifying their own account
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot modify your own account' },
        { status: 400 }
      );
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

    const { action, newRole } = requestBody;

    if (!action || !['suspend', 'activate', 'change_role'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (suspend, activate, change_role)' },
        { status: 400 }
      );
    }

    // Find the user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        googleId: true,
        password: true
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent suspending other admins unless you're a super admin
    if (targetUser.role === 'ADMIN' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only super admins can modify other admin accounts' },
        { status: 403 }
      );
    }

    let updatedUser;
    const adminId = session.user.id;
    const now = new Date();

    try {
      switch (action) {
        case 'suspend':
          if (!targetUser.isActive) {
            return NextResponse.json(
              { error: 'User is already suspended' },
              { status: 400 }
            );
          }

          updatedUser = await prisma.user.update({
            where: { id },
            data: {
              isActive: false,
              updatedAt: now
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true
            }
          });

          return NextResponse.json({
            message: `User "${targetUser.name || targetUser.email}" has been suspended`,
            action: 'suspend',
            user: updatedUser
          });

        case 'activate':
          if (targetUser.isActive) {
            return NextResponse.json(
              { error: 'User is already active' },
              { status: 400 }
            );
          }

          updatedUser = await prisma.user.update({
            where: { id },
            data: {
              isActive: true,
              updatedAt: now
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true
            }
          });

          return NextResponse.json({
            message: `User "${targetUser.name || targetUser.email}" has been activated`,
            action: 'activate',
            user: updatedUser
          });

        case 'change_role':
          if (!newRole || !['USER', 'ADMIN', 'MODERATOR'].includes(newRole)) {
            return NextResponse.json(
              { error: 'Valid role is required (USER, ADMIN, MODERATOR)' },
              { status: 400 }
            );
          }

          if (targetUser.role === newRole) {
            return NextResponse.json(
              { error: 'User already has this role' },
              { status: 400 }
            );
          }

          // Only ADMIN can assign ADMIN roles
          if (newRole === 'ADMIN' && userRole !== 'ADMIN') {
            return NextResponse.json(
              { error: 'Only super admins can assign admin roles' },
              { status: 403 }
            );
          }

          updatedUser = await prisma.user.update({
            where: { id },
            data: {
              role: newRole,
              updatedAt: now
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true
            }
          });

          return NextResponse.json({
            message: `User "${targetUser.name || targetUser.email}" role changed from ${targetUser.role} to ${newRole}`,
            action: 'change_role',
            user: updatedUser
          });
      }
    } catch (dbError) {
      console.error('Database error during user moderation:', dbError);
      return NextResponse.json(
        { error: 'Failed to perform moderation action' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error during user moderation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
