import { isIP } from 'node:net';

import { prisma } from './prisma';
import type { AuditAction, Prisma } from '../generated/prisma';

/**
 * Append-only record of privileged actions.
 *
 * `AuditLog.actorEmail` is denormalised on purpose: if a moderator's account is
 * later deleted, the history of what they did must remain attributable.
 */

export interface AuditEntry {
  actorId: string | null;
  actorEmail: string;
  action: AuditAction;
  targetType: 'Item' | 'User' | 'Claim';
  targetId: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ip?: string | null;
}

/** Longest reason we persist; the API already caps this, this is defence in depth. */
const MAX_REASON_LENGTH = 500;

/** Generous ceiling for an IPv6 literal, including any zone suffix. */
const MAX_IP_LENGTH = 64;

function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;

  const trimmed = ip.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_IP_LENGTH) return null;

  // Audit rows are read by moderators; never store an arbitrary header value
  // (which can contain commas, control characters, or an injected payload).
  return isIP(trimmed) ? trimmed : null;
}

function normalizeReason(reason?: string | null): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_REASON_LENGTH);
}

/**
 * Record one privileged action.
 *
 * Never throws: an audit write failing must not roll back or fail the action
 * the moderator actually asked for. A failure is logged loudly instead, because
 * a silently missing audit trail is worse than a noisy one.
 *
 * Returns true when the entry was persisted.
 */
export async function recordAudit(entry: AuditEntry): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: normalizeReason(entry.reason),
        metadata: entry.metadata ?? undefined,
        ip: normalizeIp(entry.ip),
      },
    });

    return true;
  } catch (error) {
    console.error('[audit] FAILED to persist audit entry', {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      error,
    });
    return false;
  }
}

/**
 * Record one entry per target of a bulk action, plus a single summary entry.
 *
 * The summary row makes "who bulk-removed 40 items and why" answerable without
 * aggregating the individual rows, while the per-target rows keep every item's
 * history complete.
 */
export async function recordBulkAudit(
  entries: readonly AuditEntry[],
  summary: AuditEntry
): Promise<number> {
  let written = 0;

  for (const entry of entries) {
    if (await recordAudit(entry)) written += 1;
  }

  if (await recordAudit(summary)) written += 1;

  return written;
}

/**
 * Best-effort client IP for an audit row, taken from the proxy headers.
 */
export function auditIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return normalizeIp(forwarded.split(',')[0]);

  return normalizeIp(request.headers.get('x-real-ip'));
}
