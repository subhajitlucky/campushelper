// GET /api/admin/analytics — impact dashboard aggregates for a reporting window.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { limitV2 } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import {
  fillDailySeries,
  formatDuration,
  funnelPercentages,
  resolutionRate,
} from '@/lib/analytics';
import {
  analyticsQuerySchema,
  resolveRange,
} from '@/lib/schemas/analytics';
import {
  AdminAccessRequired,
  AuthenticationRequired,
  safeApiHandler,
} from '@/lib/errors';
import type { Prisma } from '@/generated/prisma';

/** How many zones and categories the dashboard breaks out. */
const TOP_GROUP_LIMIT = 5;


/**
 * Daily report counts, grouped in the database.
 *
 * This replaces a `findMany({ orderBy: createdAt desc, take: 10_000 })` that was
 * then bucketed in JS. Ordering by `createdAt desc` made the cap a *recency*
 * window, so the series silently described only the newest 10,000 reports while
 * the headline counted every row. Measured at 200k items with `?range=all`, the
 * posted cohort spanned **56 of 1,095 days**; `fillDailySeries` zero-filled the
 * rest, so the chart rendered ~0 posts across 95% of the window next to a
 * headline of 200,420. The cap started binding at roughly 55 days of volume, so
 * `?range=90d` and `?range=all` were already wrong.
 *
 * The same predicates as `itemWhere` are applied here, and the result set is
 * one row per day — at most ~1,095 rows for `all` — so this is both exact and
 * smaller than the capped fetch it replaces.
 */
async function dailyCounts(
  column: 'createdAt' | 'resolvedAt',
  where: string,
  params: unknown[]
): Promise<{ day: string; n: number }[]> {
  return prisma.$queryRawUnsafe<{ day: string; n: number }[]>(
    `SELECT to_char(date_trunc('day', "${column}"), 'YYYY-MM-DD') AS day, count(*)::int AS n
       FROM "Item"
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1`,
    ...params
  );
}

/**
 * Inclusive date filter for a resolved range; `all` has no lower bound.
 *
 * Returned as a plain shape rather than `Prisma.DateTimeFilter` so the same
 * value can bound non-nullable (`Item.createdAt`) and nullable
 * (`User.lastLoginAt`) timestamp columns alike.
 */
function rangeFilter(start: Date | null, end: Date): { gte?: Date; lte?: Date } {
  return start ? { gte: start, lte: end } : { lte: end };
}

/**
 * GET /api/admin/analytics
 * Report volume, resolution rate, time-to-return, daily series, top zones and
 * categories, the claims funnel, and active users for `?range=`.
 *
 * Every number is produced by a `count`, `groupBy`, `aggregate`, or a SQL
 * aggregate — rows are never loaded just to be counted or bucketed in memory.
 * The daily series is grouped in the database, and the median is computed by
 * PostgreSQL over the whole population, so every figure describes the same
 * cohort even when a window spans more rows than an export would.
 */
export async function GET(request: NextRequest) {
  return safeApiHandler(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      return AuthenticationRequired();
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
      return AdminAccessRequired();
    }

    await limitV2('analytics', session.user.id);

    const { range } = analyticsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const now = new Date();
    const { start, end } = resolveRange(range, now);

    const createdAtFilter = rangeFilter(start, end);
    // A user delete sets `status = 'DELETED'` and leaves `deletedAt` null, so
    // both representations have to be excluded or the dashboard counts reports
    // that every list and the campus map already hide.
    const itemWhere: Prisma.ItemWhereInput = {
      createdAt: createdAtFilter,
      deletedAt: null,
      status: { not: 'DELETED' },
    };
    const claimWhere: Prisma.ClaimWhereInput = { createdAt: createdAtFilter };

    const [
      posted,
      resolved,
      medianRows,
      postedDayRows,
      resolvedDayRows,
      earliestItem,
      zoneGroups,
      categoryGroups,
      claimsCreated,
      claimsApproved,
      claimsCompleted,
      activeUsers,
    ] = await Promise.all([
      prisma.item.count({ where: itemWhere }),

      prisma.item.count({ where: { ...itemWhere, status: 'RESOLVED' } }),

      // Exact median over the whole population, not a capped sample. The
      // previous `take: MAX_EXPORT_ROWS` with no ordering returned whatever
      // order the planner chose — the homepage's copy of this query was
      // measured returning the 2,000 *oldest* resolved items, giving a median
      // 4.9% off the true value and frozen on that cohort forever.
      prisma.$queryRaw<{ median_hours: number | null }[]>`
        SELECT percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600
               ) AS median_hours
          FROM "Item"
         WHERE "createdAt" >= ${createdAtFilter.gte ?? new Date(0)}
           AND "createdAt" <= ${end}
           AND "deletedAt" IS NULL
           AND "status" = 'RESOLVED'
           AND "resolvedAt" IS NOT NULL
      `,

      dailyCounts(
        'createdAt',
        `"createdAt" >= $1 AND "createdAt" <= $2 AND "deletedAt" IS NULL
           AND "status" <> 'DELETED'`,
        [createdAtFilter.gte ?? new Date(0), end]
      ),

      dailyCounts(
        'resolvedAt',
        `"createdAt" >= $1 AND "createdAt" <= $2 AND "deletedAt" IS NULL
           AND "status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL`,
        [createdAtFilter.gte ?? new Date(0), end]
      ),

      prisma.item.aggregate({
        _min: { createdAt: true },
        where: { deletedAt: null, status: { not: 'DELETED' } },
      }),

      prisma.item.groupBy({
        by: ['zoneId'],
        _count: { _all: true },
        where: { ...itemWhere, zoneId: { not: null } },
        // Ordering by a field in `by` is the supported way to rank a groupBy;
        // `zoneId` is never null here, so its count equals `_all`.
        orderBy: { _count: { zoneId: 'desc' } },
        take: TOP_GROUP_LIMIT,
      }),

      prisma.item.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        where: { ...itemWhere, categoryId: { not: null } },
        orderBy: { _count: { categoryId: 'desc' } },
        take: TOP_GROUP_LIMIT,
      }),

      prisma.claim.count({ where: claimWhere }),

      prisma.claim.count({
        where: { ...claimWhere, status: { in: ['APPROVED', 'COMPLETED'] } },
      }),

      prisma.claim.count({ where: { ...claimWhere, status: 'COMPLETED' } }),

      prisma.user.count({ where: { lastLoginAt: createdAtFilter } }),
    ]);

    const medianHoursRaw = medianRows[0]?.median_hours;
    const median =
      medianHoursRaw === null || medianHoursRaw === undefined
        ? null
        : Number(medianHoursRaw);

    const postedByDay = new Map(postedDayRows.map((row) => [row.day, row.n]));
    const resolvedByDay = new Map(resolvedDayRows.map((row) => [row.day, row.n]));

    const dayKeys = [...new Set([...postedByDay.keys(), ...resolvedByDay.keys()])].sort();

    // `all` has no lower bound, so the series starts at the earliest report on
    // record (falling back to the window end when nothing has ever been posted).
    const seriesStart = start ?? earliestItem._min.createdAt ?? end;

    const dailySeries = fillDailySeries(
      dayKeys.map((date) => ({
        date,
        posted: postedByDay.get(date) ?? 0,
        resolved: resolvedByDay.get(date) ?? 0,
      })),
      seriesStart.toISOString(),
      end.toISOString()
    );

    const zoneIds = zoneGroups.flatMap((group) => (group.zoneId ? [group.zoneId] : []));
    const categoryIds = categoryGroups.flatMap((group) =>
      group.categoryId ? [group.categoryId] : []
    );

    const [zones, categories] = await Promise.all([
      prisma.campusZone.findMany({
        where: { id: { in: zoneIds } },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      }),
    ]);

    const zoneNames = new Map(zones.map((zone) => [zone.id, zone.name] as const));
    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name] as const)
    );

    const topZones = zoneGroups.flatMap((group) =>
      group.zoneId
        ? [
            {
              id: group.zoneId,
              name: zoneNames.get(group.zoneId) ?? 'Unknown zone',
              count: group._count._all,
            },
          ]
        : []
    );

    const topCategories = categoryGroups.flatMap((group) =>
      group.categoryId
        ? [
            {
              id: group.categoryId,
              name: categoryNames.get(group.categoryId) ?? 'Unknown category',
              count: group._count._all,
            },
          ]
        : []
    );

    return NextResponse.json({
      range,
      generatedAt: now.toISOString(),
      totals: {
        posted,
        resolved,
        resolutionRate: resolutionRate(resolved, posted),
      },
      medianTimeToReturnHours: median,
      medianTimeToReturnLabel: formatDuration(median),
      dailySeries,
      topZones,
      topCategories,
      claimsFunnel: funnelPercentages(claimsCreated, claimsApproved, claimsCompleted),
      activeUsers,
    });
  });
}
