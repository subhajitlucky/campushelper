import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeApiHandler } from '@/lib/errors';

/**
 * GET /api/categories
 * Every category with its live item count, ordered for filter menus.
 *
 * Public: the taxonomy is fixed, non-sensitive, read-only data, and the lost,
 * search and resolved pages are browsable by signed-out visitors. Requiring a
 * session here left those pages showing an "Authentication required" box.
 *
 * Counts come from one grouped query mapped onto the rows rather than a count
 * per category, so the endpoint stays at two queries as the taxonomy grows.
 * Deleted items are excluded, and the fixed-size taxonomy is not paginated.
 */
export async function GET() {
  return safeApiHandler(async () => {
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          icon: true,
          sortOrder: true,
        },
      }),
      prisma.item.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
        where: { deletedAt: null, categoryId: { not: null } },
      }),
    ]);

    const itemCountByCategoryId = new Map<string, number>();
    for (const row of counts) {
      if (!row.categoryId) continue;
      itemCountByCategoryId.set(row.categoryId, row._count._all);
    }

    return NextResponse.json({
      categories: categories.map((category) => ({
        ...category,
        itemCount: itemCountByCategoryId.get(category.id) ?? 0,
      })),
    });
  });
}
