'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Bookmark,
  CheckCheck,
  Inbox,
  KeyRound,
  KeySquare,
  MessageSquare,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthFetch } from '@/lib/auth-fetch';
import {
  formatRelativeTime,
  isUnread,
  notificationIconName,
} from '@/lib/notification-display';
import { showError, showSuccess } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

type NotificationFilter = 'all' | 'unread';

interface NotificationActor {
  id: string;
  name: string | null;
  avatar: string | null;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  itemId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: NotificationActor | null;
}

interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

/**
 * Icon components named by `notificationIconName`. Imported one by one so the
 * bundle carries the inbox icons instead of the whole lucide catalogue.
 */
const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  Bell,
  Bookmark,
  CheckCheck,
  Inbox,
  KeyRound,
  KeySquare,
  MessageSquare,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
};

/**
 * `fetchWithAuth` throws on 401 with the API's own message, which is how the
 * page tells "your session ended" apart from "the request failed".
 */
function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /authentication|log in/i.test(error.message);
}

function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading notifications">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const { fetchWithAuth } = useAuthFetch(true);
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<NotificationPagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(
    async (
      targetPage: number,
      targetFilter: NotificationFilter,
      options: { silent?: boolean } = {}
    ) => {
      if (!options.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          page: targetPage.toString(),
          limit: PAGE_SIZE.toString(),
        });

        if (targetFilter === 'unread') {
          params.set('unread', 'true');
        }

        const response = await fetchWithAuth(`/api/notifications?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to load notifications');
        }

        const data = await response.json();

        setNotifications(data.notifications ?? []);
        setPagination(
          data.pagination ?? { page: targetPage, limit: PAGE_SIZE, total: 0, totalPages: 1 }
        );
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
      } catch (err) {
        const needsSignIn = isAuthenticationError(err);
        setSignInRequired(needsSignIn);
        setError(
          needsSignIn
            ? 'Please sign in to view your notifications.'
            : 'Failed to load notifications. Please try again.'
        );
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    loadNotifications(page, filter);
  }, [page, filter, loadNotifications]);

  const handleFilterChange = (nextFilter: NotificationFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  /** Returns once the read receipt is settled; never throws, so navigation is safe. */
  const markNotificationRead = async (notification: Notification) => {
    try {
      const response = await fetchWithAuth('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ ids: [notification.id] }),
      });

      if (!response.ok) {
        return;
      }

      const readAt = new Date().toISOString();

      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, readAt } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // A failed read receipt must not stop the user from opening the target.
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (isUnread(notification.readAt)) {
      await markNotificationRead(notification);
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);

    try {
      const response = await fetchWithAuth('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ all: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      await loadNotifications(page, filter, { silent: true });
      showSuccess('All notifications marked as read');
    } catch {
      showError('Failed to mark notifications as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  };

  const subtitle =
    unreadCount > 0
      ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
      : 'You have no unread notifications';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
          >
            <CheckCheck className="mr-2 size-4" />
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </Button>
        </div>

        <div
          className="mb-4 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1"
          role="group"
          aria-label="Filter notifications"
        >
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleFilterChange(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                filter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading && <NotificationListSkeleton />}

        {!loading && error && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center shadow-sm">
            <p className="mb-4 text-gray-600">{error}</p>
            {signInRequired ? (
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/auth/login?callbackUrl=/notifications">Sign In</Link>
              </Button>
            ) : (
              <Button
                onClick={() => loadNotifications(page, filter)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <EmptyState
              icon={
                filter === 'unread' ? (
                  <Inbox className="h-16 w-16 mx-auto" />
                ) : (
                  <Bell className="h-16 w-16 mx-auto" />
                )
              }
              title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
              description={
                filter === 'unread'
                  ? 'You have read everything in your inbox. Switch to All to look back at older notifications.'
                  : 'Claim updates, comments, matches, and handover messages will show up here.'
              }
            />
          </div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <>
            <ul className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-200">
              {notifications.map((notification) => {
                const unread = isUnread(notification.readAt);
                const Icon = NOTIFICATION_ICONS[notificationIconName(notification.type)] ?? Bell;

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors',
                        'hover:bg-gray-50',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                        unread && 'border-l-4 border-blue-600 bg-blue-50'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-full',
                          unread ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-medium text-gray-900">
                            {unread && <span className="sr-only">Unread: </span>}
                            {notification.title}
                          </span>
                          {unread && (
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-2 flex-shrink-0 rounded-full bg-blue-600"
                            />
                          )}
                        </span>
                        <span className="mt-1 block text-sm text-gray-600">
                          {notification.body}
                        </span>
                        <time
                          dateTime={notification.createdAt}
                          className="mt-1 block text-sm text-gray-500"
                        >
                          {formatRelativeTime(notification.createdAt)}
                        </time>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              total={pagination.total}
              className="mt-6"
            />
          </>
        )}
      </div>
    </div>
  );
}
