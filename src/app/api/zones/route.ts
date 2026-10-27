import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeApiHandler } from '@/lib/errors';

/**
 * GET /api/zones
 * Campus zones with live item counts and a lost/found split for the map view.
 *
 * Public: the map is a browse surface, and zone names plus aggregate counts
 * reveal nothing about an individual report. Only non-deleted reports are
 * counted, matching the default visibility of `GET /api/items`.
 *
 * The zone list and the counts are fetched together, and one grouped query by
 * zone *and* item type supplies both the per-zone total and the split, so this
 * stays at two queries no matter how many zones exist.
 */
export async function GET() {
  return safeApiHandler(async () => {
    const [zones, counts] = await Promise.all([
      prisma.campusZone.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          mapX: true,
          mapY: true,
          sortOrder: true,
        },
      }),
      prisma.item.groupBy({
        by: ['zoneId', 'itemType'],
        _count: { _all: true },
        where: { deletedAt: null, status: { not: 'DELETED' }, zoneId: { not: null } },
      }),
    ]);

    const splitByZoneId = new Map<string, { lostCount: number; foundCount: number }>();
    for (const row of counts) {
      if (!row.zoneId) continue;
      const split = splitByZoneId.get(row.zoneId) ?? { lostCount: 0, foundCount: 0 };
      if (row.itemType === 'LOST') {
        split.lostCount += row._count._all;
      } else {
        split.foundCount += row._count._all;
      }
      splitByZoneId.set(row.zoneId, split);
    }

    return NextResponse.json({
      zones: zones.map((zone) => {
        const split = splitByZoneId.get(zone.id) ?? { lostCount: 0, foundCount: 0 };
        return {
          ...zone,
          itemCount: split.lostCount + split.foundCount,
          lostCount: split.lostCount,
          foundCount: split.foundCount,
        };
      }),
    });
  });
}
