// POST /api/admin/items/bulk — bulk flag, remove, or restore of item reports.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitV2 } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { auditIpFromRequest, recordBulkAudit, type AuditEntry } from '@/lib/audit';
import { bulkItemActionSchema, type BulkItemActionInput } from '@/lib/schemas/admin';
import {
  AdminAccessRequired,
  AuthenticationRequired,
  safeApiHandler,
} from '@/lib/errors';
import type { AuditAction, Prisma } from '@/generated/prisma';

/** Audit action recorded for each per-item row of a bulk run. */
const ITEM_AUDIT_ACTIONS: Record<BulkItemActionInput['action'], AuditAction> = {
  FLAG: 'ITEM_FLAG',
  REMOVE: 'ITEM_REMOVE',
  RESTORE: 'ITEM_RESTORE',
};

/**
 * Moderation fields written by one bulk item action.
 *
 * `ItemUncheckedUpdateManyInput` rather than `ItemUpdateManyMutationInput` is
 * required because `updateMany` writes the moderator and deleter foreign keys
 * as scalar columns instead of nested relation writes.
 */
function itemActionData(
  action: BulkItemActionInput['action'],
  moderatorId: string,
  reason: string | undefined
): Prisma.ItemUncheckedUpdateManyInput {
  const now = new Date();

  switch (action) {
    case 'FLAG':
      return {
        moderationStatus: 'FLAGGED',
        moderatedById: moderatorId,
        moderatedAt: now,
        moderationReason: reason ?? null,
      };
    case 'REMOVE':
      return {
        moderationStatus: 'REMOVED',
        status: 'DELETED',
        deletedAt: now,
        deletedById: moderatorId,
        deletionReason: reason ?? null,
      };
    case 'RESTORE':
      return {
        moderationStatus: 'NONE',
        // `status` is deliberately omitted here: it depends on the item's own
        // `itemType`, and hardcoding 'LOST' left restored FOUND reports
        // mislabelled. RESTORE writes status per item below.
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        moderationReason: null,
      };
  }
}

/**
 * POST /api/admin/items/bulk
 * Apply one moderation action to every listed item, notifying each owner.
 *
 * The requested ids are read before the write so the response can distinguish
 * ids that no longer exist, and so every audit row and notification names a real
 * item rather than an id the caller guessed.
 */
export async function POST(request: NextRequest) {
  return safeApiHandler(async () => {
    const csrfError = await checkCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    const session = await getSession();
    if (!session?.user?.id) {
      return AuthenticationRequired();
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') {
      return AdminAccessRequired();
    }

    await limitV2('bulkAdmin', session.user.id);

    const { ids, action, reason } = bulkItemActionSchema.parse(await request.json());

    const items = await prisma.item.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, postedById: true, itemType: true },
    });

    const foundIds = new Set(items.map((item) => item.id));
    const notFound = ids.filter((id) => !foundIds.has(id));

    // Run the write in a transaction so the whole bulk run commits or rolls back
    // as one unit if the handler ever grows additional statements.
    const updated = await prisma.$transaction(async (tx) => {
      const data = itemActionData(action, session.user.id, reason);

      if (action === 'RESTORE') {
        // `updateMany` cannot vary a column per row, and a restored item must
        // return to the status its own type implies.
        for (const item of items) {
          await tx.item.update({
            where: { id: item.id },
            data: { ...data, status: item.itemType === 'FOUND' ? 'FOUND' : 'LOST' },
          });
        }

        return items.length;
      }

      const result = await tx.item.updateMany({
        where: { id: { in: ids } },
        data,
      });

      return result.count;
    });

    const ip = auditIpFromRequest(request);
    const actorEmail = session.user.email ?? 'unknown';

    await recordBulkAudit(
      items.map(
        (item): AuditEntry => ({
          actorId: session.user.id,
          actorEmail,
          action: ITEM_AUDIT_ACTIONS[action],
          targetType: 'Item',
          targetId: item.id,
          reason,
          ip,
        })
      ),
      {
        actorId: session.user.id,
        actorEmail,
        action: 'BULK_ITEM_ACTION',
        targetType: 'Item',
        targetId: 'bulk',
        reason,
        metadata: { action, updated, notFound },
        ip,
      }
    );

    await Promise.all(
      items.map((item) =>
        notify({
          userId: item.postedById,
          type: 'MODERATION_ACTION',
          itemId: item.id,
          itemTitle: item.title,
          reason,
          actorId: session.user.id,
        })
      )
    );

    return NextResponse.json({ updated, notFound, action });
  });
}
