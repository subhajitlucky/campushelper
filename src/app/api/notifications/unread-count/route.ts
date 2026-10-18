import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AuthenticationRequired, safeApiHandler } from '@/lib/errors';

/**
 * GET /api/notifications/unread-count
 * Unread badge count for the signed-in user.
 */
export async function GET() {
  return safeApiHandler(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    });

    return NextResponse.json({ unreadCount });
  });
}
