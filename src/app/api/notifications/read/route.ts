import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitV2 } from '@/lib/rateLimit';
import { AuthenticationRequired, safeApiHandler } from '@/lib/errors';
import { markNotificationsReadSchema } from '@/lib/schemas/notification';

/**
 * POST /api/notifications/read
 * Mark the signed-in user's notifications as read, either all or a list of ids.
 *
 * `userId` is part of every where clause, so ids belonging to another user are
 * simply not matched instead of being updated. Already-read rows are skipped,
 * which keeps the returned count the number actually changed.
 */
export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    const csrfError = await checkCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    await limitV2('notificationsRead', session.user.id);

    const payload = markNotificationsReadSchema.parse(await request.json());

    const result = await prisma.notification.updateMany({
      where:
        'all' in payload
          ? { userId: session.user.id, readAt: null }
          : { id: { in: payload.ids }, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ updated: result.count });
  });
}
