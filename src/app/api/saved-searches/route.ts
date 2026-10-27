import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitV2 } from '@/lib/rateLimit';
import {
  AuthenticationRequired,
  ErrorCodes,
  createErrorResponse,
  safeApiHandler,
} from '@/lib/errors';
import {
  MAX_SAVED_SEARCHES_PER_USER,
  createSavedSearchSchema,
} from '@/lib/schemas/saved-search';
import { readJsonBody } from '@/lib/request-body';

/** The fields every saved search is returned with. */
const savedSearchSelect = {
  id: true,
  name: true,
  filters: true,
  lastNotifiedAt: true,
  createdAt: true,
} as const;

/**
 * GET /api/saved-searches
 * The signed-in user's saved searches, newest first, capped at the per-user limit.
 */
export async function GET() {
  return safeApiHandler(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      throw AuthenticationRequired();
    }

    const savedSearches = await prisma.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAVED_SEARCHES_PER_USER,
      select: savedSearchSelect,
    });

    return NextResponse.json({ savedSearches });
  });
}

/**
 * POST /api/saved-searches
 * Save a search for the signed-in user, refused once the per-user cap is reached.
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

    await limitV2('savedSearches', session.user.id);

    const json = await readJsonBody(request);
    if (!json.ok) return json.response;

    const { name, filters } = createSavedSearchSchema.parse(json.body);

    const existingCount = await prisma.savedSearch.count({
      where: { userId: session.user.id },
    });

    if (existingCount >= MAX_SAVED_SEARCHES_PER_USER) {
      return createErrorResponse(
        `You can save at most ${MAX_SAVED_SEARCHES_PER_USER} searches. Delete one to make room.`,
        ErrorCodes.CONFLICT,
        409
      );
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: session.user.id,
        name,
        filters,
      },
      select: savedSearchSelect,
    });

    return NextResponse.json({ savedSearch }, { status: 201 });
  });
}
