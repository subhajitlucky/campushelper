import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkCSRF } from '@/lib/csrf-middleware';
import { prisma } from '@/lib/prisma';
import {
  AuthenticationRequired,
  ForbiddenError,
  NotFound,
  ValidationError,
  safeApiHandler,
} from '@/lib/errors';
import { matchActionSchema } from '@/lib/schemas/match';

/**
 * POST /api/matches/[id]
 * Dismiss or confirm a suggestion.
 *
 * Either item's owner may act: a finder dismissing a suggestion is as
 * meaningful as the person who lost the item doing so, and requiring one
 * particular side would stall the flow.
 *
 * Listing suggestions lives at `GET /api/items/[id]/matches`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeApiHandler(async () => {
    const csrfCheck = await checkCSRF(request);
    if (csrfCheck) {
      return csrfCheck;
    }

    const { id } = await params;

    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    const match = await prisma.matchSuggestion.findUnique({
      where: { id },
      select: {
        id: true,
        lostItem: { select: { postedById: true } },
        foundItem: { select: { postedById: true } },
      },
    });

    if (!match) {
      throw NotFound('Match suggestion');
    }

    const isOwner =
      match.lostItem.postedById === session.user.id ||
      match.foundItem.postedById === session.user.id;
    const isModerator = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';

    if (!isOwner && !isModerator) {
      throw ForbiddenError('Only the owners of these items can update this suggestion.');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ValidationError('Invalid JSON in request body');
    }

    const { action } = matchActionSchema.parse(body);

    const updated = await prisma.matchSuggestion.update({
      where: { id },
      data: { status: action === 'dismiss' ? 'DISMISSED' : 'CONFIRMED' },
      select: { id: true, status: true, score: true },
    });

    return NextResponse.json({
      match: updated,
      message:
        action === 'dismiss'
          ? 'Match dismissed. It will not be suggested again.'
          : 'Match confirmed. Use the claim flow to arrange the handover.',
    });
  });
}
