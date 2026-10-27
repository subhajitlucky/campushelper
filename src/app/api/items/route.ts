import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  AuthenticationRequired,
  AdminAccessRequired,
  ValidationError,
  ErrorCodes,
  createErrorResponse,
  safeApiHandler,
} from '@/lib/errors';
import { limitItems } from '@/lib/rateLimit';
import { checkCSRF } from '@/lib/csrf-middleware';
import { createItemApiSchema } from '@/lib/schemas/item';
import { isoDateSchema, limitSchema, pageSchema } from '@/lib/schemas/query';
import { findLikelyDuplicates, type MatchableItem } from '@/lib/matching';
import { computeMatchesForItem } from '@/lib/match-service';
import { evaluateSavedSearchesForItem } from '@/lib/saved-search-service';
import { awardReputation } from '@/lib/reputation-service';
import type { Prisma } from '@/generated/prisma';

const ITEM_STATUSES = ['LOST', 'FOUND', 'CLAIMED', 'RESOLVED', 'DELETED'] as const;
const ITEM_TYPES = ['LOST', 'FOUND'] as const;

type ItemStatus = (typeof ITEM_STATUSES)[number];
type ItemType = (typeof ITEM_TYPES)[number];

/** How far back the duplicate guard looks. */
const DUPLICATE_LOOKBACK_DAYS = 30;

/** Cap on candidates scored by the duplicate guard. */
const DUPLICATE_CANDIDATE_LIMIT = 25;

/**
 * GET /api/items
 * Fetch all items with pagination and optional filtering.
 */
export async function GET(request: NextRequest) {
  return safeApiHandler(async () => {
    const { searchParams } = new URL(request.url);

    const rawStatus = searchParams.get('status');
    const rawItemType = searchParams.get('itemType');

    if (rawStatus && !ITEM_STATUSES.includes(rawStatus as ItemStatus)) {
      throw ValidationError(`Invalid status. Allowed values: ${ITEM_STATUSES.join(', ')}`);
    }
    if (rawItemType && !ITEM_TYPES.includes(rawItemType as ItemType)) {
      throw ValidationError(`Invalid itemType. Allowed values: ${ITEM_TYPES.join(', ')}`);
    }

    const status = rawStatus as ItemStatus | undefined;
    const itemType = rawItemType as ItemType | undefined;
    const search = searchParams.get('search') || undefined;
    const postedById = searchParams.get('postedById') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const location = searchParams.get('location') || undefined;
    const categorySlug = searchParams.get('category') || undefined;
    const zoneSlug = searchParams.get('zone') || undefined;
    const tagFilter = searchParams.get('tags')
      ? searchParams
          .get('tags')!
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0)
      : undefined;

    // Strict parsing: `parseInt('1abc')` silently meant page 1, and a page
    // beyond the safe integer range produced a `skip` Prisma cannot represent.
    const page = pageSchema.parse(searchParams.get('page') ?? undefined);
    const limit = limitSchema(20).parse(searchParams.get('limit') ?? undefined);

    if (from && !isoDateSchema.safeParse(from).success) {
      throw ValidationError('From date must be a valid ISO date');
    }
    if (to && !isoDateSchema.safeParse(to).success) {
      throw ValidationError('To date must be a valid ISO date');
    }
    /*
     * Bound the offset, because `skip` is O(offset) in Postgres and this is a
     * public, unauthenticated endpoint.
     *
     * Measured at 200k items: `OFFSET 0` costs 0.036 ms and 5 buffers, `OFFSET
     * 100000` costs 38.5-68.4 ms and 100,388 buffers, and `OFFSET 190000` costs
     * 78.8-497 ms and 186,530 buffers plus 4,605 physical reads — because the
     * planner walks and discards every skipped row. A keyset/cursor API is the
     * real fix; until the client can express one, a ceiling stops a crawler (or
     * a `for` loop) from turning one cheap endpoint into a table scan per
     * request. The equivalent keyset page at the same position is 0.058 ms.
     *
     * 200 pages of 100 is 20,000 rows deep, which is far past any browsing
     * behaviour this app can produce today (35 reports in production) and still
     * inside the range where the offset costs single-digit milliseconds.
     */
    const MAX_PAGE = 200;

    if (page > MAX_PAGE) {
      throw ValidationError(
        `Page must be ${MAX_PAGE} or lower. Narrow the results with a search or filter to reach older reports.`
      );
    }

    const skip = (page - 1) * limit;

    const session = await getSession();
    const isLoggedIn = !!session?.user?.id;

    // Deleted items are only visible to admins/moderators
    if (
      status === 'DELETED' &&
      session?.user?.role !== 'ADMIN' &&
      session?.user?.role !== 'MODERATOR'
    ) {
      throw AdminAccessRequired();
    }

    // Resolve taxonomy slugs to ids once, rather than per row.
    const [category, zone] = await Promise.all([
      categorySlug
        ? prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } })
        : null,
      zoneSlug
        ? prisma.campusZone.findUnique({ where: { slug: zoneSlug }, select: { id: true } })
        : null,
    ]);

    // An unknown slug must match nothing rather than silently dropping the
    // filter, which would otherwise return the entire table.
    if (categorySlug && !category) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        filters: { status, itemType, location, search, category: categorySlug, zone: zoneSlug },
        user: { isLoggedIn, ...(isLoggedIn && { userId: session?.user?.id }) },
      });
    }
    if (zoneSlug && !zone) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        filters: { status, itemType, location, search, category: categorySlug, zone: zoneSlug },
        user: { isLoggedIn, ...(isLoggedIn && { userId: session?.user?.id }) },
      });
    }

    // One where-clause, reused by both the page query and the count. Keeping
    // these in step is what makes `total` trustworthy.
    const where: Prisma.ItemWhereInput = {
      ...(status ? { status } : { status: { not: 'DELETED' } }),
      ...(itemType && { itemType }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(from && { createdAt: { gte: new Date(from) } }),
      ...(to && { createdAt: { lte: new Date(to) } }),
      ...(postedById && { postedById }),
      ...(category && { categoryId: category.id }),
      ...(zone && { zoneId: zone.id }),
      // Array containment: the item must carry every requested tag.
      ...(tagFilter && tagFilter.length > 0 && { tags: { hasEvery: tagFilter } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        // An explicit `select`, never `include`. With `include` Prisma returns
        // every scalar, which leaked `moderationReason`, `moderatedById`, and the
        // precise `latitude`/`longitude` pin to every signed-in student (and to
        // anonymous callers for resolved items). The admin-only CSV export and
        // the single-item projection both withhold these on purpose.
        select: {
          id: true,
          title: true,
          description: true,
          itemType: true,
          status: true,
          location: true,
          images: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          postedById: true,
          claimedById: true,
          categoryId: true,
          zoneId: true,
          // Email intentionally excluded from the items list (IDOR hardening).
          postedBy: { select: { id: true, name: true, avatar: true, reputation: true } },
          category: { select: { id: true, slug: true, name: true, icon: true } },
          zone: { select: { id: true, slug: true, name: true } },
        },
      }),
      prisma.item.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        commentsCount: 0,
        claimsCount: 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        status,
        itemType,
        location,
        search,
        postedById,
        from,
        to,
        category: categorySlug,
        zone: zoneSlug,
        tags: tagFilter,
      },
      user: {
        isLoggedIn,
        ...(isLoggedIn && { userId: session?.user?.id }),
      },
    });
  });
}

/**
 * POST /api/items
 * Create a new item, warning about likely duplicates first.
 */
export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    const csrfCheck = await checkCSRF(request);
    if (csrfCheck) {
      return csrfCheck;
    }

    const session = await getSession();

    if (!session?.user?.id) {
      throw AuthenticationRequired('Please log in to create an item.');
    }

    await limitItems(request, session.user.id);

    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
      throw ValidationError('Invalid JSON in request body');
    }

    // Shared schema: the form and the API validate identically.
    const data = createItemApiSchema.parse(requestBody);

    const [category, zone] = await Promise.all([
      data.categorySlug
        ? prisma.category.findUnique({ where: { slug: data.categorySlug }, select: { id: true } })
        : null,
      data.zoneSlug
        ? prisma.campusZone.findUnique({ where: { slug: data.zoneSlug }, select: { id: true } })
        : null,
    ]);

    if (data.categorySlug && !category) {
      throw ValidationError(`Unknown category "${data.categorySlug}"`, {
        field: 'categorySlug',
      });
    }
    if (data.zoneSlug && !zone) {
      throw ValidationError(`Unknown campus zone "${data.zoneSlug}"`, { field: 'zoneSlug' });
    }

    const createdAt = new Date();
    const candidate: MatchableItem = {
      id: 'pending',
      itemType: data.itemType,
      title: data.title,
      description: data.description,
      location: data.location,
      categoryId: category?.id ?? null,
      zoneId: zone?.id ?? null,
      tags: data.tags ?? [],
      createdAt,
    };

    if (!data.acknowledgeDuplicates) {
      const duplicates = await findDuplicates(candidate, session.user.id);
      if (duplicates.length > 0) {
        // 409 with the candidates attached, so the client can show them and
        // offer "post anyway".
        return createErrorResponse(
          'This looks like a duplicate of an item you already posted.',
          ErrorCodes.DUPLICATE_SUSPECTED,
          409,
          {
            candidates: duplicates,
            hint: 'Resend with acknowledgeDuplicates: true to post anyway.',
          }
        );
      }
    }

    const status = data.itemType === 'LOST' ? 'LOST' : 'FOUND';

    const newItem = await prisma.item.create({
      data: {
        title: data.title,
        description: data.description,
        itemType: data.itemType,
        status,
        location: data.location,
        images: (data.images ?? []).filter((image) => image && image.trim() !== '') as string[],
        postedById: session.user.id,
        categoryId: category?.id ?? null,
        zoneId: zone?.id ?? null,
        tags: data.tags ?? [],
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
      include: {
        postedBy: { select: { id: true, name: true, email: true, avatar: true } },
        category: { select: { id: true, slug: true, name: true, icon: true } },
        zone: { select: { id: true, slug: true, name: true } },
      },
    });

    // Side effects. None of these may fail the request: the item already exists.
    await Promise.all([
      computeMatchesForItem(newItem.id),
      evaluateSavedSearchesForItem({
        id: newItem.id,
        title: newItem.title,
        description: newItem.description,
        location: newItem.location,
        itemType: newItem.itemType,
        categoryId: newItem.categoryId,
        zoneId: newItem.zoneId,
        tags: newItem.tags,
        createdAt: newItem.createdAt,
        postedById: newItem.postedById,
      }),
      awardReputation(session.user.id, 'ITEM_POSTED', { itemId: newItem.id }),
    ]);

    return NextResponse.json(
      {
        message: 'Item created successfully',
        item: { ...newItem, commentsCount: 0, claimsCount: 0, comments: undefined, claims: undefined },
      },
      { status: 201 }
    );
  });
}

/**
 * Score the poster's recent items of the same type against the candidate.
 *
 * Bounded to one page of recent rows so the guard stays cheap on every post.
 */
async function findDuplicates(candidate: MatchableItem, postedById: string) {
  const since = new Date(candidate.createdAt.getTime() - DUPLICATE_LOOKBACK_DAYS * 86400000);

  const recent = await prisma.item.findMany({
    where: {
      postedById,
      itemType: candidate.itemType,
      deletedAt: null,
      createdAt: { gte: since },
    },
    select: {
      id: true,
      title: true,
      itemType: true,
      description: true,
      location: true,
      categoryId: true,
      zoneId: true,
      tags: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: DUPLICATE_CANDIDATE_LIMIT,
  });

  return findLikelyDuplicates(candidate, recent).map((match) => ({
    id: match.item.id,
    title: match.item.title,
    itemType: match.item.itemType,
    location: match.item.location,
    createdAt: match.item.createdAt.toISOString(),
    score: match.score,
    reasons: match.reasons,
  }));
}
