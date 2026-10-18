// GET /api/admin/analytics — impact dashboard aggregates for a reporting window.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { limitV2 } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import {
  fillDailySeries,
  formatDuration,
  funnelPercentages,
  medianTimeToReturnHours,
  resolutionRate,
} from '@/lib/analytics';
import {
  analyticsQuerySchema,
  MAX_EXPORT_ROWS,
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

const MS_PER_HOUR = 60 * 60 * 1000;

/** `YYYY-MM-DD` key for a UTC day, matching the buckets `fillDailySeries` reads. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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

/** Count one occurrence per timestamp, keyed by UTC day. */
function countByDay(dates: readonly Date[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const date of dates) {
    const key = utcDayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

/**
 * GET /api/admin/analytics
 * Report volume, resolution rate, time-to-return, daily series, top zones and
 * categories, the claims funnel, and active users for `?range=`.
 *
 * Every number is produced by a `count`, `groupBy`, `aggregate` or a capped
 * column-only fetch — rows are never loaded just to be counted in memory. The
 * two exceptions are the daily series and the time-to-return durations, which
 * both need per-row timestamps to bucket, and both are capped at
 * {@link MAX_EXPORT_ROWS} so a large window cannot pull the table into the app.
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
    const itemWhere: Prisma.ItemWhereInput = { createdAt: createdAtFilter, deletedAt: null };
    const claimWhere: Prisma.ClaimWhereInput = { createdAt: createdAtFilter };
    const resolvedWhere: Prisma.ItemWhereInput = {
      ...itemWhere,
      status: 'RESOLVED',
      resolvedAt: { not: null },
    };

    const [
      posted,
      resolved,
      durationRows,
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

      prisma.item.findMany({
        where: resolvedWhere,
        select: { createdAt: true, resolvedAt: true },
        take: MAX_EXPORT_ROWS,
      }),

      // Newest first so the capped sample is deterministic rather than whatever
      // order the planner happens to return.
      prisma.item.findMany({
        where: itemWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_EXPORT_ROWS,
      }),

      prisma.item.findMany({
        where: resolvedWhere,
        select: { resolvedAt: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_EXPORT_ROWS,
      }),

      prisma.item.aggregate({ _min: { createdAt: true }, where: { deletedAt: null } }),

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

    const durationsHours = durationRows.flatMap((row) =>
      row.resolvedAt ? [(row.resolvedAt.getTime() - row.createdAt.getTime()) / MS_PER_HOUR] : []
    );
    const median = medianTimeToReturnHours(durationsHours);

    const postedByDay = countByDay(postedDayRows.map((row) => row.createdAt));
    const resolvedByDay = countByDay(
      resolvedDayRows.flatMap((row) => (row.resolvedAt ? [row.resolvedAt] : []))
    );

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
