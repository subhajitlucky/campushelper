import { prisma } from './prisma';
import { formatNotification, type NotificationContentInput } from './notification-content';
import type { NotificationType } from '../generated/prisma';

/**
 * Creates in-app notifications.
 *
 * Every write goes through {@link notify} so the two rules that matter are
 * applied in one place: a user is never notified about their own action, and
 * repeated identical notifications collapse instead of piling up.
 */

/** Window within which an identical unread notification is treated as a repeat. */
export const DEDUPE_WINDOW_MINUTES = 5;

export interface NotifyInput extends NotificationContentInput {
  userId: string;
  /** Who caused this. Pass the actor's id so self-notifications are suppressed. */
  actorId?: string | null;
  itemId?: string | null;
  link?: string | null;
}

/**
 * True when `userId` should not be notified, because they caused the event.
 */
function isSelfNotification(userId: string, actorId?: string | null): boolean {
  return Boolean(actorId) && actorId === userId;
}

/**
 * Create one notification.
 *
 * Returns the created notification id, or `null` when nothing was written
 * (self-notification, or a duplicate inside the dedupe window). Notification
 * failures must never fail the request that triggered them, so this function
 * logs and returns `null` rather than throwing.
 */
export async function notify(input: NotifyInput): Promise<string | null> {
  if (isSelfNotification(input.userId, input.actorId)) return null;

  const { title, body } = formatNotification(input);

  try {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000);

    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type as NotificationType,
        itemId: input.itemId ?? null,
        // The actor is part of the identity of the event. Without it, a second
        // person claiming (or commenting on) the same item within the window was
        // silently suppressed, so the poster never learned about them.
        actorId: input.actorId ?? null,
        readAt: null,
        createdAt: { gte: since },
      },
      select: { id: true },
    });

    if (existing) return null;

    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type as NotificationType,
        title,
        body,
        link: input.link ?? null,
        itemId: input.itemId ?? null,
      },
      select: { id: true },
    });

    return created.id;
  } catch (error) {
    console.error('[notifications] failed to create notification', error);
    return null;
  }
}

/**
 * Create many notifications with two statements instead of two per input.
 *
 * `notify()` is correct but costs a `findFirst` plus a `create` per call, which
 * is fine for a single event and quadratic for a fan-out. The match path called
 * it twice per new pair — measured at 902 `SELECT` + 501 `INSERT` on
 * `Notification` for one item creation, which was most of a 2.3-second write.
 *
 * Returns the number created. Same contract as `notify()`: never throws, and
 * logs rather than surfacing a failure to the caller's request.
 *
 * Dedupe is a single indexed query over `(userId, type, itemId, actorId)` for
 * the whole batch. It keeps `notify()`'s semantics — self-notifications are
 * dropped, and an identical *unread* notification inside the window collapses —
 * with one deliberate difference: `notify()` could only see duplicates that
 * already existed, so two identical inputs *within one batch* both got written.
 * This collapses those too, which is strictly closer to the stated rule.
 */
export async function notifyMany(inputs: readonly NotifyInput[]): Promise<number> {
  const candidates = inputs.filter((input) => !isSelfNotification(input.userId, input.actorId));
  if (candidates.length === 0) return 0;

  // Collapse identical inputs inside the batch before touching the database.
  const seen = new Set<string>();
  const unique = candidates.filter((input) => {
    const key = `${input.userId}|${input.type}|${input.itemId ?? ''}|${input.actorId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  try {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000);

    // One query covers the whole batch: `(userId, createdAt)` is indexed and the
    // item ids are a bounded set, so this stays an index scan.
    const userIds = [...new Set(unique.map((input) => input.userId))];
    // `null` is a meaningful item id here (a notification with no item), and an
    // `in` list of non-null ids would exclude exactly those rows from the dedupe
    // check — so absent ids are matched with a separate `OR`.
    const itemIds = [...new Set(unique.map((input) => input.itemId).filter((id): id is string => Boolean(id)))];
    const hasItemless = unique.some((input) => !input.itemId);

    const existing = await prisma.notification.findMany({
      where: {
        userId: { in: userIds },
        readAt: null,
        createdAt: { gte: since },
        OR: [
          ...(itemIds.length > 0 ? [{ itemId: { in: itemIds } }] : []),
          ...(hasItemless ? [{ itemId: null }] : []),
        ],
      },
      select: { userId: true, type: true, itemId: true, actorId: true },
    });

    const alreadyNotified = new Set(
      existing.map(
        (row) => `${row.userId}|${row.type}|${row.itemId ?? ''}|${row.actorId ?? ''}`
      )
    );

    const toCreate = unique
      .filter(
        (input) =>
          !alreadyNotified.has(
            `${input.userId}|${input.type}|${input.itemId ?? ''}|${input.actorId ?? ''}`
          )
      )
      .map((input) => {
        const { title, body } = formatNotification(input);

        return {
          userId: input.userId,
          actorId: input.actorId ?? null,
          type: input.type as NotificationType,
          title,
          body,
          link: input.link ?? null,
          itemId: input.itemId ?? null,
        };
      });

    if (toCreate.length === 0) return 0;

    const result = await prisma.notification.createMany({ data: toCreate });

    return result.count;
  } catch (error) {
    console.error('[notifications] failed to create notification batch', error);
    return 0;
  }
}

