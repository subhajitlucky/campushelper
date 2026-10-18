'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { cn } from '@/lib/utils';

/** How often the badge is refreshed while the app stays open. */
const POLL_INTERVAL_MS = 30000;

/** Above this the badge shows "99+" so it cannot stretch the navbar. */
const MAX_DISPLAYED_COUNT = 99;

/**
 * `fetchWithAuth(true)` throws with an authentication message when there is no
 * session, and the same is true of the API's 401 for a session that expires
 * mid-poll, so the badge can tell "signed out" from "poll failed".
 */
function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /authentication|log in/i.test(error.message);
}

/**
 * Navbar bell showing the signed-in user's unread notification count.
 *
 * Polling is deliberately quiet: a failed poll leaves the navbar untouched, and
 * a visitor who is not signed in gets nothing at all instead of an empty bell.
 */
export default function NotificationBell() {
  const { fetchWithAuth } = useAuthFetch(true);
  const { status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSignedOut, setIsSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const pollUnreadCount = async () => {
      try {
        const response = await fetchWithAuth('/api/notifications/unread-count');

        if (cancelled || !response.ok) {
          return;
        }

        const data = await response.json();

        if (!cancelled && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        // A background poll must never break the navbar, so failures stay silent.
        if (!cancelled && isAuthenticationError(error)) {
          setIsSignedOut(true);
        }
      }
    };

    pollUnreadCount();

    const intervalId = setInterval(pollUnreadCount, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [fetchWithAuth]);

  if (status === 'unauthenticated' || isSignedOut) {
    return null;
  }

  const hasUnread = unreadCount > 0;
  const ariaLabel = hasUnread ? `Notifications (${unreadCount} unread)` : 'Notifications';

  return (
    <Link
      href="/notifications"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex size-10 items-center justify-center rounded-md text-gray-700 transition-colors',
        'hover:bg-gray-100 hover:text-gray-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
      )}
    >
      <Bell className="size-5" aria-hidden="true" />
      {/* The live region carries the count for screen readers; the badge below is
          hidden from them so the number is not announced twice. */}
      <span className="absolute -right-1.5 -top-1.5" aria-live="polite">
        {hasUnread && (
          <span
            aria-hidden="true"
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-5 text-white"
          >
            {unreadCount > MAX_DISPLAYED_COUNT ? `${MAX_DISPLAYED_COUNT}+` : unreadCount}
          </span>
        )}
        <span className="sr-only">
          {hasUnread ? `${unreadCount} unread notifications` : 'No unread notifications'}
        </span>
      </span>
    </Link>
  );
}
