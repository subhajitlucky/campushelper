import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  AuthenticationRequired,
  ForbiddenError,
  NotFound,
  safeApiHandler,
} from '@/lib/errors';
import { getMatchesForItem } from '@/lib/match-service';

/**
 * GET /api/items/[id]/matches
 * Possible LOST/FOUND counterparts for one item.
 *
 * Only the poster (or a moderator) may see suggestions: they are derived from
 * the full description, and exposing them broadly would leak detail about
 * items the viewer has no business seeing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeApiHandler(async () => {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, postedById: true },
    });

    if (!item) {
      throw NotFound('Item');
    }

    const isOwner = item.postedById === session.user.id;
    const isModerator = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    if (!isOwner && !isModerator) {
      throw ForbiddenError('Only the poster can view match suggestions for this item.');
    }

    const includeDismissed =
      new URL(request.url).searchParams.get('includeDismissed') === 'true';

    const matches = await getMatchesForItem(id, { includeDismissed });

    return NextResponse.json({ matches, total: matches.length });
  });
}
