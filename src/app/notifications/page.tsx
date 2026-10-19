'use client';

import { useCallback, useEffect, useState } from 'react';
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
import PageHeader from '@/components/ui/PageHeader';
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

interface NotificationDay {
  /** DOM id — `day-0`, `day-1`, … A date string is not a valid id. */
  id: string;
  /** Calendar day this group covers, used to detect the group boundary. */
  key: string;
  label: string;
  items: Notification[];
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

/** Shared geometry for the headerless "tabs" (filter here, tabs on /dashboard). */
const UNDERLINE_BUTTON = [
  '-mb-px whitespace-nowrap rounded-t-sm border-b-2 px-0.5 pb-3 pt-1',
  'text-sm font-medium transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
].join(' ');

/**
 * `fetchWithAuth` throws on 401 with the API's own message, which is how the
 * page tells "your session ended" apart from "the request failed".
 */
function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /authentication|log in/i.test(error.message);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayLabel(date: Date, today: Date, yesterday: Date): string {
  if (Number.isNaN(date.getTime())) return 'Earlier';

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';

  return date.toLocaleDateString(
    'en-IN',
    date.getFullYear() === today.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

/**
 * Collapse a page of notifications into day groups, newest first.
 *
 * The API already orders by `createdAt desc`; the copy is sorted defensively so
 * a single out-of-order row cannot produce two "Today" headings.
 */
function groupByDay(notifications: Notification[]): NotificationDay[] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const ordered = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const groups: NotificationDay[] = [];

  for (const notification of ordered) {
    const date = new Date(notification.createdAt);
    const key = Number.isNaN(date.getTime()) ? 'earlier' : date.toDateString();
    const current = groups[groups.length - 1];

    if (current?.key === key) {
      current.items.push(notification);
      continue;
    }

    groups.push({
      id: `day-${groups.length}`,
      key,
      label: dayLabel(date, today, yesterday),
      items: [notification],
    });
  }

  return groups;
}

function NotificationRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading notifications">
      <div className="flex items-center gap-3 pb-1 pt-8">
        <Skeleton className="h-3 w-16" />
        <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
      </div>

      <ul className="divide-y divide-border-subtle">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="flex items-start gap-4 py-5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Notification inbox.
 *
 * Rows, not cards: one full-width list separated by `divide-border-subtle`, with
 * day dividers between the groups. An unread row is marked by a 2px accent bar
 * on its leading edge and a `font-medium` title — no coloured background, no
 * badge dot, nothing that turns a list into a patchwork. The type icon sits in a
 * 32px muted circle, and "Mark all as read" is a quiet text action in the page
 * header rather than a bordered button floating above the list.
 *
 * Behaviour is untouched: the same 20-per-page fetch, the same mark-read POST
 * (single row on click, `{ all: true }` for the header action), the same
 * All/Unread filter with `aria-pressed`, and the same pagination.
 */
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

  const days = groupByDay(notifications);

  return (
    <main className="page-canvas min-h-screen pb-24 pt-10 sm:pt-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Notifications"
          description={subtitle}
          actions={
            <Button
              variant="quiet"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markingAll}
            >
              <CheckCheck className="mr-1.5 size-4" aria-hidden="true" />
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </Button>
          }
        />

        <div
          className="flex items-center gap-6 border-b border-border sm:gap-8"
          role="group"
          aria-label="Filter notifications"
        >
          {FILTERS.map((option) => {
            const pressed = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFilterChange(option.value)}
                aria-pressed={pressed}
                className={cn(
                  UNDERLINE_BUTTON,
                  pressed
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="rise-in">
          {loading && <NotificationRowsSkeleton />}

          {!loading && error && (
            <EmptyState
              icon={signInRequired ? <ShieldAlert /> : <Bell />}
              title={signInRequired ? 'Sign in to view notifications' : 'Notifications unavailable'}
              description={error}
              action={
                signInRequired
                  ? {
                      label: 'Sign in',
                      variant: 'default',
                      onClick: () => router.push('/auth/login?callbackUrl=/notifications'),
                    }
                  : { label: 'Try again', onClick: () => loadNotifications(page, filter) }
              }
            />
          )}

          {!loading && !error && notifications.length === 0 && (
            <EmptyState
              icon={filter === 'unread' ? <Inbox /> : <Bell />}
              title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
              description={
                filter === 'unread'
                  ? 'You have read everything in your inbox. Switch to All to look back at older notifications.'
                  : 'Claim updates, comments, matches, and handover messages will show up here.'
              }
            />
          )}

          {!loading && !error && notifications.length > 0 && (
            <>
              {days.map((day) => (
                <section key={day.id} aria-labelledby={day.id}>
                  <div className="flex items-center gap-3 pb-1 pt-8">
                    <h2 id={day.id} className="text-xs font-medium text-muted-foreground">
                      {day.label}
                    </h2>
                    <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                  </div>

                  <ul className="divide-y divide-border-subtle">
                    {day.items.map((notification) => {
                      const unread = isUnread(notification.readAt);
                      const Icon =
                        NOTIFICATION_ICONS[notificationIconName(notification.type)] ?? Bell;

                      return (
                        <li key={notification.id}>
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              'relative flex w-full items-start gap-4 py-5 text-left transition-colors',
                              'hover:bg-muted/40',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
                            )}
                          >
                            {/* Unread marker: a 2px accent bar, never a fill */}
                            {unread && (
                              <span
                                aria-hidden="true"
                                className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                              />
                            )}

                            <span
                              className={cn(
                                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted',
                                unread ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              <Icon className="size-4" aria-hidden="true" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-4">
                                <span
                                  className={cn(
                                    'text-base text-foreground',
                                    unread && 'font-medium'
                                  )}
                                >
                                  {unread && <span className="sr-only">Unread: </span>}
                                  {notification.title}
                                </span>

                                <time
                                  dateTime={notification.createdAt}
                                  className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
                                >
                                  {formatRelativeTime(notification.createdAt)}
                                </time>
                              </span>

                              <span className="mt-1 line-clamp-2 text-base text-foreground/85">
                                {notification.body}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                total={pagination.total}
                className="mt-12"
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
