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

