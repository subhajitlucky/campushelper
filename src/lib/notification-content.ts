import type { NotificationType } from '../generated/prisma';

/**
 * Renders notification titles and bodies.
 *
 * Content is composed at *write* time so the inbox stays readable even after the
 * source item is renamed or deleted. This module is pure: it performs no I/O and
 * does not escape HTML, because notification text is rendered as text by React,
 * which escapes at render time.
 *
 * Handover codes are deliberately never included. A code that leaks into an
 * inbox listing would defeat the point of asking for it at the handover.
 */

export const MAX_BODY_LENGTH = 200;

const FALLBACK_ACTOR = 'Someone';
const FALLBACK_ITEM = 'your item';

export type ClaimStatusForNotification =
  | 'PENDING'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED';

export interface NotificationContentInput {
  type: NotificationType;
  actorName?: string | null;
  itemTitle?: string | null;
  status?: ClaimStatusForNotification | null;
  reason?: string | null;
  /** Search name or query text, used by SAVED_SEARCH_HIT. */
  query?: string | null;
}

export interface NotificationContent {
  title: string;
  body: string;
}

/**
 * Truncate to `max` characters at a word boundary, appending an ellipsis.
 * The returned string never exceeds `max`.
 */
export function truncateAtWord(text: string, max: number = MAX_BODY_LENGTH): string {
  if (text.length <= max) return text;

  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;

  return `${cut.trimEnd()}…`;
}

function actor(input: NotificationContentInput): string {
  const name = input.actorName?.trim();
  return name && name.length > 0 ? name : FALLBACK_ACTOR;
}

function item(input: NotificationContentInput): string {
  const title = input.itemTitle?.trim();
  return title && title.length > 0 ? `"${title}"` : FALLBACK_ITEM;
}

function claimOutcome(status: ClaimStatusForNotification | null | undefined): {
  headline: string;
  sentence: string;
} {
  switch (status) {
    case 'APPROVED':
      return {
        headline: 'Your claim was approved',
        sentence: 'A handover code has been issued to both parties. Meet in person and exchange the code when the item changes hands.',
      };
    case 'COMPLETED':
      return {
        headline: 'Handover complete',
        sentence: 'The handover was verified and the item is now marked as returned. Thanks for closing the loop.',
      };
    case 'REJECTED':
      return {
        headline: 'Your claim was rejected',
        sentence: 'The poster rejected this claim. You can still comment on the item if you have more evidence.',
      };
    case 'PENDING':
    default:
      return {
        headline: 'Your claim is pending review',
        sentence: 'The poster has been notified and will review your claim.',
      };
  }
}

/**
 * Build the title and body for a notification.
 *
 * Every branch guarantees a non-empty title and body, and the body is truncated
 * to {@link MAX_BODY_LENGTH}.
 */
export function formatNotification(input: NotificationContentInput): NotificationContent {
  const who = actor(input);
  const what = item(input);

  let title: string;
  let body: string;

  switch (input.type) {
    case 'CLAIM_CREATED':
      title = 'New claim on your item';
      body = `${who} filed a claim on ${what}. Review it to approve or reject, and check the proof they provided.`;
      break;

    case 'CLAIM_STATUS_CHANGED': {
      const outcome = claimOutcome(input.status);
      title = outcome.headline;
      body = `Your claim on ${what}. ${outcome.sentence}`;
      break;
    }

    case 'COMMENT_ON_ITEM':
      title = 'New comment on your item';
      body = `${who} commented on ${what}. Open the item to read the message and reply.`;
      break;

    case 'MATCH_FOUND':
      title = 'Possible match found';
      body = `We found a report that may describe the same item as ${what}. Review the match and confirm or dismiss it.`;
      break;

    case 'SAVED_SEARCH_HIT': {
      const query = input.query?.trim();
      const label = query && query.length > 0 ? `"${query}"` : 'your saved search';
      title = 'New item matching your saved search';
      body = `${what} matches ${label}. Open it to check whether it is yours.`;
      break;
    }

    case 'HANDOVER_CODE_ISSUED':
      title = 'Handover code issued';
      body = `A handover code has been issued for ${what}. Share it only when the item is physically in your hands, and never before.`;
      break;

    case 'HANDOVER_VERIFIED':
      title = 'Handover verified';
      body = `The handover for ${what} was verified in person. The item is now marked as returned.`;
      break;

    case 'ITEM_RESOLVED':
      title = 'Item marked as returned';
      body = `${what} has been marked as returned to its owner. Thanks for helping reunite it.`;
      break;

    case 'MODERATION_ACTION': {
      const reason = input.reason?.trim();
      title = 'Moderation action on your item';
      body = reason
        ? `A moderator took action on ${what}. Reason given: ${reason}`
        : `A moderator took action on ${what}. Open your dashboard to review the outcome and appeal if needed.`;
      break;
    }

    default:
      title = 'CampusHelper update';
      body = `There is a new update on ${what}. Open the app to see the details.`;
      break;
  }

  return { title, body: truncateAtWord(body) };
}
