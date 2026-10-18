import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitV2 } from '@/lib/rateLimit';
import { AuthenticationRequired, NotFound, safeApiHandler } from '@/lib/errors';
import { savedSearchIdParamSchema } from '@/lib/schemas/saved-search';

/**
 * DELETE /api/saved-searches/[id]
 * Delete one of the signed-in user's saved searches.
 *
 * Every lookup is scoped by `userId` as well as `id`, so another user's search
 * is indistinguishable from one that does not exist and can never be deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = savedSearchIdParamSchema.parse(await params);

    const savedSearch = await prisma.savedSearch.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });

    if (!savedSearch) {
      throw NotFound('Saved search');
    }

    await prisma.savedSearch.delete({
      where: { id: savedSearch.id, userId: session.user.id },
    });

    return NextResponse.json({ message: 'Saved search deleted' });
  });
}
