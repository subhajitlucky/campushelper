import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  AuthenticationRequired, 
  AdminAccessRequired,
  NotFound,
  ValidationError,
  UserAlreadySuspended,
  UserAlreadyActive,
  RoleAlreadyAssigned,
  SelfModificationDenied,
  CannotModifyAdmin,
  safeApiHandler 
} from '@/lib/errors';

/**
 * PUT /api/admin/users/[id]
 * Admin user moderation actions: suspend, activate, change role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeApiHandler(async () => {
    // Check admin authentication
    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    // Check admin authorization
    const userRole = session.user.role;
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
    
    if (!isAdmin) {
      throw AdminAccessRequired();
    }

    const { id } = await params;
    if (!id) {
      throw ValidationError('User ID is required');
    }

    // Prevent admin from modifying their own account
    if (id === session.user.id) {
      throw SelfModificationDenied();
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      throw ValidationError('Invalid JSON in request body');
    }

    const { action, newRole } = requestBody;

    if (!action || !['suspend', 'activate', 'change_role'].includes(action)) {
      throw ValidationError('Valid action is required (suspend, activate, change_role)');
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
      throw NotFound('User');
    }

    // Prevent suspending other admins unless you're a super admin
    if (targetUser.role === 'ADMIN' && userRole !== 'ADMIN') {
      throw CannotModifyAdmin();
    }

    let updatedUser;
    const adminId = session.user.id;
    const now = new Date();

    switch (action) {
      case 'suspend':
        if (!targetUser.isActive) {
          throw UserAlreadySuspended();
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
          throw UserAlreadyActive();
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
          throw ValidationError('Valid role is required (USER, ADMIN, MODERATOR)');
        }

        if (targetUser.role === newRole) {
          throw RoleAlreadyAssigned();
        }

        // Only ADMIN can assign ADMIN roles
        if (newRole === 'ADMIN' && userRole !== 'ADMIN') {
          throw CannotModifyAdmin();
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
  });
}
