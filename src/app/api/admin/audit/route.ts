// GET /api/admin/audit — paginated, filterable audit trail for administrators.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  AdminAccessRequired,
  AuthenticationRequired,
  safeApiHandler,
} from '@/lib/errors';
import { auditQuerySchema } from '@/lib/schemas/admin';
import type { Prisma } from '@/generated/prisma';

/**
 * GET /api/admin/audit
 * Read the append-only audit trail, newest first.
 *
 * Only the filters actually supplied are applied, and the same `where` object
 * feeds both the page query and the count so `total` always describes the rows
 * the caller can page through.
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

    const query = auditQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.targetType) {
      where.targetType = query.targetType;
    }

    if (query.targetId) {
      where.targetId = query.targetId;
    }

    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          actor: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      entries,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  });
}
