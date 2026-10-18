/**
 * Presentation helpers for the notification inbox.
 *
 * Pure module: no React and no fetching, so the navbar bell and the inbox page
 * share one set of rules for icons, relative timestamps, and read state.
 */

/** Fallback for notification types this build does not know about. */
const DEFAULT_ICON = 'Bell';

/**
 * Icon *names* rather than components, so this module stays free of React.
 * Callers map the name to a component from their own explicit import list,
 * which keeps tree-shaking working.
 */
const ICON_BY_TYPE: Record<string, string> = {
  CLAIM_CREATED: 'Inbox',
  CLAIM_STATUS_CHANGED: 'CheckCheck',
  COMMENT_ON_ITEM: 'MessageSquare',
  MATCH_FOUND: 'Sparkles',
  SAVED_SEARCH_HIT: 'Bookmark',
  HANDOVER_CODE_ISSUED: 'KeyRound',
  HANDOVER_CODE_INVALIDATED: 'KeySquare',
  HANDOVER_VERIFIED: 'ShieldCheck',
  ITEM_RESOLVED: 'PackageCheck',
  MODERATION_ACTION: 'ShieldAlert',
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Lucide icon name for a notification type; unknown types get a bell so a new
 * server-side type still renders instead of crashing the inbox.
 */
export function notificationIconName(type: string): string {
  return ICON_BY_TYPE[type] ?? DEFAULT_ICON;
}

/**
 * A notification is unread until the server stamps `readAt`. `undefined` is
 * treated like `null` so a partial payload cannot mark a row as read.
 */
export function isUnread(readAt?: string | null): boolean {
  return !readAt;
}

function formatAbsoluteDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Human-readable age of an ISO timestamp, e.g. "just now" or "2 hours ago".
 *
 * Falls back to an absolute date at seven days, so a timestamp is never
 * reported as "43 days ago". Future timestamps (clock skew between the client
 * and the server) read as "just now", and an unparseable string yields '' so
 * callers can render nothing rather than "Invalid Date".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return '';
  }

  const elapsedMs = now.getTime() - timestamp;
  if (elapsedMs < 0) {
    return 'just now';
  }

  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'yesterday';
  }
  if (days <= 6) {
    return `${days} days ago`;
  }

  return formatAbsoluteDate(date);
}
