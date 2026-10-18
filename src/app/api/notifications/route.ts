import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuthenticationRequired, safeApiHandler } from '@/lib/errors';
import { notificationsQuerySchema } from '@/lib/schemas/notification';

/**
 * GET /api/notifications
 * The signed-in user's notification inbox, newest first.
 *
 * `unreadCount` is always the user's absolute unread total, even when the list
 * itself is filtered to unread rows, so an unread badge stays correct either way.
 */
export async function GET(request: NextRequest) {
  return safeApiHandler(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    const { page, limit, unread } = notificationsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const where = {
      userId: session.user.id,
      ...(unread ? { readAt: null } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          itemId: true,
          readAt: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: session.user.id, readAt: null },
      }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  });
}
