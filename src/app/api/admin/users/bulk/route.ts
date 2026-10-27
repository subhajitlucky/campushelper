// POST /api/admin/users/bulk — bulk deactivate, reactivate, or student verification.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkCSRF } from '@/lib/csrf-middleware';
import { limitV2 } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { auditIpFromRequest, recordBulkAudit, type AuditEntry } from '@/lib/audit';
import { bulkUserActionSchema, type BulkUserActionInput } from '@/lib/schemas/admin';
import { readJsonBody } from '@/lib/request-body';
import {
  AdminAccessRequired,
  AuthenticationRequired,
  safeApiHandler,
} from '@/lib/errors';
import type { AuditAction, Prisma } from '@/generated/prisma';

/** Audit action recorded for each per-user row of a bulk run. */
const USER_AUDIT_ACTIONS: Record<BulkUserActionInput['action'], AuditAction> = {
  DEACTIVATE: 'USER_DEACTIVATE',
  REACTIVATE: 'USER_REACTIVATE',
  VERIFY_STUDENT: 'USER_ROLE_CHANGE',
  UNVERIFY_STUDENT: 'USER_ROLE_CHANGE',
};

/**
 * Fields written by one bulk user action.
 *
 * Deactivation also bumps `sessionVersion` by one. The auth callback invalidates
 * any JWT whose `sessionVersion` no longer matches the database, so that bump is
 * what actually logs the user out instead of leaving them signed in until their
 * token expires.
 */
function userActionData(
  action: BulkUserActionInput['action']
): Prisma.UserUpdateManyMutationInput {
  switch (action) {
    case 'DEACTIVATE':
      return { isActive: false, sessionVersion: { increment: 1 } };
    case 'REACTIVATE':
      // Deliberately leaves `sessionVersion` untouched: reactivation has no
      // outstanding token to revoke, and bumping it would sign the user out of
      // every other device they are legitimately using.
      return { isActive: true };
    case 'VERIFY_STUDENT':
      return { verifiedStudent: true };
    case 'UNVERIFY_STUDENT':
      return { verifiedStudent: false };
  }
}

/**
 * POST /api/admin/users/bulk
 * Apply one account action to every listed user, notifying each affected user.
 *
 * Two ids are never touched: the caller's own account, and — unless the caller
 * is an ADMIN — any account with the ADMIN role. Both are reported back instead
 * of being silently dropped.
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

    const callerId = session.user.id;
    const callerRole = session.user.role;

    const json = await readJsonBody(request);
    if (!json.ok) return json.response;

    const { ids, action, reason } = bulkUserActionSchema.parse(json.body);

    // Self-modification is refused for every role: a bulk run must never be able
    // to lock the caller out of the console they are moderating from.
    const skippedSelf = ids.filter((id) => id === callerId);
    const candidateIds = ids.filter((id) => id !== callerId);

    const users = await prisma.user.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, role: true },
    });

    const foundIds = new Set(users.map((user) => user.id));
    const notFound = candidateIds.filter((id) => !foundIds.has(id));

    // Only a super admin may act on another admin's account.
    const skippedAdmins = users
      .filter((user) => user.role === 'ADMIN' && callerRole !== 'ADMIN')
      .map((user) => user.id);

    const actionableUsers = users.filter(
      (user) => !(user.role === 'ADMIN' && callerRole !== 'ADMIN')
    );
    const actionableIds = actionableUsers.map((user) => user.id);

    // Run the write in a transaction so the whole bulk run commits or rolls back
    // as one unit if the handler ever grows additional statements.
    const updated = await prisma.$transaction(async (tx) => {
      if (actionableIds.length === 0) {
        return 0;
      }

      const result = await tx.user.updateMany({
        where: { id: { in: actionableIds } },
        data: userActionData(action),
      });

      return result.count;
    });

    const ip = auditIpFromRequest(request);
    const actorEmail = session.user.email ?? 'unknown';
    const isVerificationChange =
      action === 'VERIFY_STUDENT' || action === 'UNVERIFY_STUDENT';

    await recordBulkAudit(
      actionableUsers.map(
        (user): AuditEntry => ({
          actorId: callerId,
          actorEmail,
          action: USER_AUDIT_ACTIONS[action],
          targetType: 'User',
          targetId: user.id,
          reason,
          metadata: isVerificationChange
            ? { verifiedStudent: action === 'VERIFY_STUDENT' }
            : undefined,
          ip,
        })
      ),
      {
        actorId: callerId,
        actorEmail,
        action: 'BULK_USER_ACTION',
        targetType: 'User',
        targetId: 'bulk',
        reason,
        metadata: { action, updated, notFound, skippedSelf, skippedAdmins },
        ip,
      }
    );

    await Promise.all(
      actionableUsers.map((user) =>
        notify({
          userId: user.id,
          type: 'MODERATION_ACTION',
          reason,
          actorId: callerId,
        })
      )
    );

    return NextResponse.json({
      updated,
      notFound,
      skippedSelf,
      skippedAdmins,
      action,
    });
  });
}
