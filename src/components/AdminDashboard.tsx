'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Eye,
  Flag,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  XCircle
} from 'lucide-react';

import AnalyticsPanel, { StatsStrip } from '@/components/admin/AnalyticsPanel';
import AuditLogTable from '@/components/admin/AuditLogTable';
import BulkActionBar from '@/components/admin/BulkActionBar';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import SectionHeader from '@/components/ui/SectionHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError, showSuccess } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

/**
 * Admin dashboard.
 *
 * Six sections behind an underline tab strip. Every record list is a real table
 * (brief §4.7): records are rows with dividers, not cards, because at campus
 * scale a page of cards is unreadable and unbounded. Headline figures are a
 * plain numbers strip rather than four bordered tiles.
 *
 * Behaviour is unchanged from the card version: the same moderation endpoints,
 * the same confirmations, the same envelopes, the same toasts. Selection is
 * still kept per target so a stale selection can never be posted to the wrong
 * endpoint.
 */

interface AdminStats {
  totalUsers: number;
  totalItems: number;
  totalClaims: number;
  pendingClaims: number;
  activeItems: number;
  inactiveUsers: number;
  resolvedItems: number;
  deletedItems: number;
}

interface AdminItem {
  id: string;
  title: string;
  description: string;
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
  itemType: 'LOST' | 'FOUND';
  location: string;
  createdAt: string;
  postedBy: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
  };
  claimCount: number;
  commentCount: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  isActive: boolean;
  createdAt: string;
  itemsCount: number;
  claimsCount: number;
}

interface AdminClaim {
  id: string;
  claimType: 'FOUND_IT' | 'OWN_IT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message: string;
  createdAt: string;
  item: {
    id: string;
    title: string;
    status: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type AdminTab = 'overview' | 'items' | 'users' | 'claims' | 'analytics' | 'audit';

type ListTarget = 'items' | 'users' | 'claims';

const TABS: { id: AdminTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'claims', label: 'Claims', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];

const PAGE_SIZE = 20;

/** Only these tabs read a list from `fetchAdminData`; analytics and audit load themselves. */
function isListTab(tab: AdminTab): tab is 'overview' | ListTarget {
  return tab === 'overview' || tab === 'items' || tab === 'users' || tab === 'claims';
}

/**
 * One table treatment for every admin list. `border-separate` is deliberate:
 * with collapsed borders a sticky header loses its bottom rule as soon as it
 * detaches, which is exactly when the rule matters.
 */
const TABLE = 'w-full border-separate border-spacing-0 text-sm';
const TH =
  'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-background px-3 py-2.5 text-left text-xs font-medium text-muted-foreground';
const TD = 'border-b border-border-subtle px-3 py-3 align-middle';

/** Relative dates, the way a person would say them; the exact date stays on `title`. */
function relativeDate(iso: string) {
  const then = new Date(iso);
  const diffMinutes = Math.round((Date.now() - then.getTime()) / 60000);

  if (!Number.isFinite(diffMinutes)) return '';
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? 'yesterday' : `${days} days ago`;

  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function absoluteDate(iso: string) {
  const then = new Date(iso);

  return Number.isNaN(then.getTime())
    ? iso
    : then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-4 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    />
  );
}

/** Row-shaped skeleton: the table's geometry, so nothing jumps when data lands. */
function TabPanelSkeleton({ tab }: { tab: AdminTab }) {
  if (tab === 'overview') {
    return (
      <div className="space-y-6" role="status" aria-label="Loading platform totals">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="status" aria-label="Loading records">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 border-b border-border-subtle pb-3"
          >
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
            <Skeleton className="size-8 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { fetchWithAuth } = useAuthFetch(true);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});

  // Bulk moderation selection. Kept per-target so switching tabs cannot carry a
  // stale selection into the wrong endpoint.
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  };

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  };

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [claims, setClaims] = useState<AdminClaim[]>([]);

  const [listPage, setListPage] = useState<Record<ListTarget, number>>({
    items: 1,
    users: 1,
    claims: 1,
  });
  const [listTotal, setListTotal] = useState<Record<ListTarget, number>>({
    items: 0,
    users: 0,
    claims: 0,
  });
  const [listPages, setListPages] = useState<Record<ListTarget, number>>({
    items: 1,
    users: 1,
    claims: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add moderation state and handlers
  const [moderatingItem, setModeratingItem] = useState<string | null>(null);

  // Add user moderation state and handlers
  const [moderatingUser, setModeratingUser] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState('');

  // Check admin authorization
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';

  const fetchAdminData = useCallback(async () => {
    if (!isListTab(activeTab)) {
      // Analytics and audit own their loading state; nothing to fetch here.
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch overview stats
      if (activeTab === 'overview') {
        const statsResponse = await fetch('/api/admin/stats', {
          credentials: 'include',
        });

        if (!statsResponse.ok) {
          throw new Error('Could not load the platform totals.');
        }

        setStats(await statsResponse.json());
      }

      // Fetch items
      if (activeTab === 'items') {
        const itemsResponse = await fetch(
          `/api/admin/items?page=${listPage.items}&limit=${PAGE_SIZE}`,
          { credentials: 'include' }
        );

        if (!itemsResponse.ok) {
          throw new Error('Could not load items.');
        }

        const itemsData = await itemsResponse.json();
        const pagination: ListPagination | undefined = itemsData.pagination;
        setItems(Array.isArray(itemsData.items) ? itemsData.items : []);
        setListTotal((current) => ({ ...current, items: pagination?.total ?? 0 }));
        setListPages((current) => ({ ...current, items: pagination?.totalPages ?? 1 }));
      }

      // Fetch users
      if (activeTab === 'users') {
        const usersResponse = await fetch(
          `/api/admin/users?page=${listPage.users}&limit=${PAGE_SIZE}`,
          { credentials: 'include' }
        );

        if (!usersResponse.ok) {
          throw new Error('Could not load users.');
        }

        const usersData = await usersResponse.json();
        const pagination: ListPagination | undefined = usersData.pagination;
        setUsers(Array.isArray(usersData.users) ? usersData.users : []);
        setListTotal((current) => ({ ...current, users: pagination?.total ?? 0 }));
        setListPages((current) => ({ ...current, users: pagination?.totalPages ?? 1 }));
      }

      // Fetch claims
      if (activeTab === 'claims') {
        const claimsResponse = await fetch(
          `/api/admin/claims?page=${listPage.claims}&limit=${PAGE_SIZE}`,
          { credentials: 'include' }
        );

        if (!claimsResponse.ok) {
          throw new Error('Could not load claims.');
        }

        const claimsData = await claimsResponse.json();
        const pagination: ListPagination | undefined = claimsData.pagination;
        setClaims(Array.isArray(claimsData.claims) ? claimsData.claims : []);
        setListTotal((current) => ({ ...current, claims: pagination?.total ?? 0 }));
        setListPages((current) => ({ ...current, claims: pagination?.totalPages ?? 1 }));
      }
    } catch (caught) {
      showError('Failed to load admin data. Please try again.');
      setError(caught instanceof Error ? caught.message : 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, listPage.items, listPage.users, listPage.claims]);

  useEffect(() => {
    if (isAdmin) {
      void fetchAdminData();
    }
  }, [isAdmin, fetchAdminData]);

  useEffect(() => {
    if (!showRoleModal) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRoleModal(false);
        setSelectedUser(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showRoleModal]);

  // Handle item moderation actions
  const handleItemModeration = async (itemId: string, action: 'force_delete' | 'flag_spam' | 'unflag_spam') => {
    let confirmMessage = '';

    switch (action) {
      case 'force_delete':
        confirmMessage = 'Are you sure you want to force delete this item? This will permanently remove it and all its comments.';
        break;
      case 'flag_spam':
        confirmMessage = 'Are you sure you want to flag this item as spam? It will be hidden from public view.';
        break;
      case 'unflag_spam':
        confirmMessage = 'Are you sure you want to unflag this item? It will be restored to public view.';
        break;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setModeratingItem(itemId);

    try {
      const response = await fetchWithAuth(`/api/admin/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Moderation action failed');
      }

      const data = await response.json();

      // Show success message
      showSuccess(data.message);

      // Refresh the items list
      await fetchAdminData();

    } catch {
      showError('Failed to perform moderation action. Please try again.');
    } finally {
      setModeratingItem(null);
    }
  };

  // Handle user moderation actions
  const handleUserModeration = async (userId: string, action: 'suspend' | 'activate') => {
    const actionText = action === 'suspend' ? 'suspend' : 'activate';
    const confirmMessage = `Are you sure you want to ${actionText} this user? They will ${action === 'suspend' ? 'lose access to their account' : 'regain access to their account'}.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setModeratingUser(userId);

    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'User moderation action failed');
      }

      const data = await response.json();

      // Show success message
      showSuccess(data.message);

      // Refresh the users list
      await fetchAdminData();

    } catch {
      showError('Failed to perform moderation action. Please try again.');
    } finally {
      setModeratingUser(null);
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, role: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${role}?`)) {
      return;
    }

    setModeratingUser(userId);

    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'change_role', newRole: role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Role change failed');
      }

      const data = await response.json();

      // Show success message
      showSuccess(data.message);

      // Refresh the users list
      await fetchAdminData();

    } catch {
      showError('Failed to change role. Please try again.');
    } finally {
      setModeratingUser(null);
      setShowRoleModal(false);
      setSelectedUser(null);
    }
  };

  // Tab strip: arrow keys move selection, as a tablist is one tab stop.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = TABS.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = lastIndex;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  // Row actions. Icon buttons keep the actions column narrow; every one carries
  // a label, and the destructive ones are ghost-with-destructive-text rather
  // than a filled red block.
  const renderItemActions = (item: AdminItem) => {
    const isDeleted = item.status === 'DELETED';
    const isSpam = item.status === 'RESOLVED' && item.title.includes('[SPAM]'); // Simple spam detection
    const isModerating = moderatingItem === item.id;

    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => window.open(`/item/${item.id}`, '_blank')}
          disabled={isModerating}
          aria-label={`View ${item.title} in a new tab`}
          title="View item"
        >
          <Eye className="size-4" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleItemModeration(item.id, isSpam ? 'unflag_spam' : 'flag_spam')}
          disabled={isModerating || isDeleted}
          aria-label={isSpam ? `Unflag ${item.title}` : `Flag ${item.title} as spam`}
          title={isSpam ? 'Unflag spam' : 'Flag as spam'}
          className={cn(isSpam && 'text-warning hover:bg-warning/10 hover:text-warning')}
        >
          {isModerating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Flag className="size-4" aria-hidden="true" />
          )}
        </Button>

        {item.status !== 'DELETED' && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleItemModeration(item.id, 'force_delete')}
            disabled={isModerating}
            aria-label={`Force delete ${item.title}`}
            title="Force delete"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  };

  const renderUserActions = (user: AdminUser) => {
    const isModerating = moderatingUser === user.id;
    const isOwnAccount = session?.user?.id === user.id; // Prevent self-modification
    const displayName = user.name || user.email;

    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => window.open(`/dashboard?user=${user.id}`, '_blank')}
          disabled={isModerating}
          aria-label={`Open the profile of ${displayName} in a new tab`}
          title="View profile"
        >
          <Eye className="size-4" aria-hidden="true" />
        </Button>

        {!isOwnAccount && user.role === 'USER' && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleUserModeration(user.id, user.isActive ? 'suspend' : 'activate')}
            disabled={isModerating}
            aria-label={user.isActive ? `Suspend ${displayName}` : `Activate ${displayName}`}
            title={user.isActive ? 'Suspend account' : 'Activate account'}
            className={cn(
              user.isActive
                ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                : 'text-success hover:bg-success/10 hover:text-success'
            )}
          >
            {isModerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : user.isActive ? (
              <XCircle className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}

        {!isOwnAccount && user.role !== 'USER' && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setSelectedUser(user);
              setNewRole('');
              setShowRoleModal(true);
            }}
            disabled={isModerating}
            aria-label={`Change the role of ${displayName}`}
            title="Change role"
          >
            <Shield className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  };

  const refreshButton = (
    <Button variant="outline" size="sm" onClick={() => void fetchAdminData()} disabled={loading}>
      <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} aria-hidden="true" />
      Refresh
    </Button>
  );

  const renderPanel = () => {
    // Analytics and audit load their own data, so they are never gated on this
    // component's loading flag.
    if (activeTab === 'analytics') return <AnalyticsPanel />;
    if (activeTab === 'audit') return <AuditLogTable />;

    if (error) {
      return (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
        >
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void fetchAdminData()}>
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      );
    }

    if (loading) return <TabPanelSkeleton tab={activeTab} />;

    if (activeTab === 'overview') {
      if (!stats) {
        return (
          <EmptyState
            icon={<BarChart3 aria-hidden="true" />}
            title="No totals available"
            description="The platform figures could not be read just now."
            action={{ label: 'Try again', onClick: () => void fetchAdminData(), variant: 'outline' }}
          />
        );
      }

      return (
        <div className="space-y-6">
          <SectionHeader
            divider={false}
            title="At a glance"
            description="Platform totals right now."
          />
          <StatsStrip
            items={[
              {
                label: 'Total users',
                value: String(stats.totalUsers),
                hint: `${stats.inactiveUsers} inactive`,
              },
              {
                label: 'Total items',
                value: String(stats.totalItems),
                hint: `${stats.resolvedItems} resolved`,
              },
              {
                label: 'Pending claims',
                value: String(stats.pendingClaims),
                hint: `${stats.totalClaims} total claims`,
              },
              {
                label: 'Deleted items',
                value: String(stats.deletedItems),
                hint: `${stats.activeItems} active`,
              },
            ]}
          />
        </div>
      );
    }

    if (activeTab === 'items') {
      const idsOnPage = items.map((item) => item.id);
      const selectedOnPage = idsOnPage.filter((id) => selectedItemIds.includes(id)).length;
      const allOnPageSelected = idsOnPage.length > 0 && selectedOnPage === idsOnPage.length;

      const toggleAllOnPage = () => {
        setSelectedItemIds((current) =>
          allOnPageSelected
            ? current.filter((id) => !idsOnPage.includes(id))
            : Array.from(new Set([...current, ...idsOnPage]))
        );
      };

      return (
        <div className="space-y-6">
          <SectionHeader
            divider={false}
            title="All items"
            description={
              listTotal.items > 0
                ? `${listTotal.items} ${listTotal.items === 1 ? 'item' : 'items'}, newest first.`
                : 'Newest first.'
            }
            action={refreshButton}
          />

          <div key={`items-page-${listPage.items}`} className="max-h-[70vh] overflow-auto">
            <table className={TABLE}>
              <caption className="sr-only">
                Items posted on campus, with claims, comments and moderation actions.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, 'w-10')}>
                    <SelectionCheckbox
                      checked={allOnPageSelected}
                      indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                      onChange={toggleAllOnPage}
                      label="Select every item on this page for a bulk action"
                    />
                  </th>
                  <th scope="col" className={TH}>
                    Item
                  </th>
                  <th scope="col" className={cn(TH, 'hidden md:table-cell')}>
                    Location
                  </th>
                  <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>
                    Posted by
                  </th>
                  <th scope="col" className={cn(TH, 'hidden text-right sm:table-cell')}>
                    Claims
                  </th>
                  <th scope="col" className={cn(TH, 'hidden text-right lg:table-cell')}>
                    Comments
                  </th>
                  <th scope="col" className={cn(TH, 'hidden sm:table-cell')}>
                    Posted
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                  <th scope="col" className={cn(TH, 'text-right')}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border-b border-border-subtle">
                      <EmptyState
                        icon={<Package aria-hidden="true" />}
                        title="No items to moderate"
                        description="Items appear here as soon as students post them."
                        action={{
                          label: 'Refresh',
                          variant: 'outline',
                          onClick: () => void fetchAdminData(),
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/40">
                      <td className={cn(TD, 'w-10')}>
                        <SelectionCheckbox
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          label={`Select ${item.title} for a bulk action`}
                        />
                      </td>
                      <td className={cn(TD, 'min-w-[18rem]')}>
                        <p className="line-clamp-1 font-medium text-foreground">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </td>
                      <td className={cn(TD, 'hidden md:table-cell')}>
                        <span className="block max-w-[10rem] truncate text-muted-foreground">
                          {item.location}
                        </span>
                      </td>
                      <td className={cn(TD, 'hidden lg:table-cell')}>
                        <span className="block max-w-[12rem] truncate text-foreground/85">
                          {item.postedBy.name || item.postedBy.email}
                        </span>
                        {item.postedBy.name && (
                          <span className="block max-w-[12rem] truncate text-xs text-muted-foreground">
                            {item.postedBy.email}
                          </span>
                        )}
                        {!item.postedBy.isActive && (
                          <span className="block text-xs text-warning">Deactivated account</span>
                        )}
                      </td>
                      <td className={cn(TD, 'hidden text-right tabular-nums sm:table-cell')}>
                        {item.claimCount}
                      </td>
                      <td className={cn(TD, 'hidden text-right tabular-nums lg:table-cell')}>
                        {item.commentCount}
                      </td>
                      <td className={cn(TD, 'hidden whitespace-nowrap sm:table-cell')}>
                        <span className="text-muted-foreground" title={absoluteDate(item.createdAt)}>
                          {relativeDate(item.createdAt)}
                        </span>
                      </td>
                      <td className={TD}>
                        <StatusBadge status={item.status} />
                        {item.itemType !== item.status && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {item.itemType === 'LOST' ? 'Lost report' : 'Found report'}
                          </span>
                        )}
                      </td>
                      <td className={cn(TD, 'text-right')}>{renderItemActions(item)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={listPage.items}
            totalPages={listPages.items}
            onPageChange={(next) => setListPage((current) => ({ ...current, items: next }))}
            total={listTotal.items}
          />

          <BulkActionBar
            target="items"
            selectedIds={selectedItemIds}
            onClear={() => setSelectedItemIds([])}
            onDone={fetchAdminData}
          />
        </div>
      );
    }

    if (activeTab === 'users') {
      const idsOnPage = users.map((user) => user.id);
      const selectedOnPage = idsOnPage.filter((id) => selectedUserIds.includes(id)).length;
      const allOnPageSelected = idsOnPage.length > 0 && selectedOnPage === idsOnPage.length;

      const toggleAllOnPage = () => {
        setSelectedUserIds((current) =>
          allOnPageSelected
            ? current.filter((id) => !idsOnPage.includes(id))
            : Array.from(new Set([...current, ...idsOnPage]))
        );
      };

      return (
        <div className="space-y-6">
          <SectionHeader
            divider={false}
            title="All users"
            description={
              listTotal.users > 0
                ? `${listTotal.users} ${listTotal.users === 1 ? 'account' : 'accounts'}, newest first.`
                : 'Newest first.'
            }
            action={refreshButton}
          />

          <div key={`users-page-${listPage.users}`} className="max-h-[70vh] overflow-auto">
            <table className={TABLE}>
              <caption className="sr-only">
                Campus accounts, with role, status and activity, and moderation actions.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, 'w-10')}>
                    <SelectionCheckbox
                      checked={allOnPageSelected}
                      indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                      onChange={toggleAllOnPage}
                      label="Select every user on this page for a bulk action"
                    />
                  </th>
                  <th scope="col" className={TH}>
                    User
                  </th>
                  <th scope="col" className={TH}>
                    Role
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                  <th scope="col" className={cn(TH, 'hidden text-right sm:table-cell')}>
                    Items
                  </th>
                  <th scope="col" className={cn(TH, 'hidden text-right sm:table-cell')}>
                    Claims
                  </th>
                  <th scope="col" className={cn(TH, 'hidden md:table-cell')}>
                    Joined
                  </th>
                  <th scope="col" className={cn(TH, 'text-right')}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border-b border-border-subtle">
                      <EmptyState
                        icon={<Users aria-hidden="true" />}
                        title="No accounts to show"
                        description="Registered accounts appear here as soon as students sign up."
                        action={{
                          label: 'Refresh',
                          variant: 'outline',
                          onClick: () => void fetchAdminData(),
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-muted/40">
                      <td className={cn(TD, 'w-10')}>
                        <SelectionCheckbox
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          label={`Select ${user.name || user.email} for a bulk action`}
                        />
                      </td>
                      <td className={cn(TD, 'min-w-[14rem]')}>
                        <p className="line-clamp-1 font-medium text-foreground">
                          {user.name || 'Anonymous user'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                      </td>
                      <td className={TD}>
                        <Badge
                          variant={
                            user.role === 'ADMIN' ? 'default' :
                            user.role === 'MODERATOR' ? 'secondary' : 'outline'
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className={TD}>
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className={cn(TD, 'hidden text-right tabular-nums sm:table-cell')}>
                        {user.itemsCount}
                      </td>
                      <td className={cn(TD, 'hidden text-right tabular-nums sm:table-cell')}>
                        {user.claimsCount}
                      </td>
                      <td className={cn(TD, 'hidden whitespace-nowrap md:table-cell')}>
                        <span className="text-muted-foreground" title={absoluteDate(user.createdAt)}>
                          {relativeDate(user.createdAt)}
                        </span>
                      </td>
                      <td className={cn(TD, 'text-right')}>{renderUserActions(user)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={listPage.users}
            totalPages={listPages.users}
            onPageChange={(next) => setListPage((current) => ({ ...current, users: next }))}
            total={listTotal.users}
          />

          <BulkActionBar
            target="users"
            selectedIds={selectedUserIds}
            onClear={() => setSelectedUserIds([])}
            onDone={fetchAdminData}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <SectionHeader
          divider={false}
          title="All claims"
          description={`${
            listTotal.claims > 0
              ? `${listTotal.claims} ${listTotal.claims === 1 ? 'claim' : 'claims'}, newest first. `
              : 'Newest first. '
          }Read-only: claim review is not available from this console yet.`}
          action={refreshButton}
        />

        <div key={`claims-page-${listPage.claims}`} className="max-h-[70vh] overflow-auto">
          <table className={TABLE}>
            <caption className="sr-only">
              Claims raised against items, with claimant, message and outcome.
            </caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  Claim
                </th>
                <th scope="col" className={TH}>
                  Item
                </th>
                <th scope="col" className={TH}>
                  Claimant
                </th>
                <th scope="col" className={cn(TH, 'hidden md:table-cell')}>
                  Message
                </th>
                <th scope="col" className={cn(TH, 'hidden sm:table-cell')}>
                  Raised
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={cn(TH, 'text-right')}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border-b border-border-subtle">
                    <EmptyState
                      icon={<MessageSquare aria-hidden="true" />}
                      title="No claims yet"
                      description="Claims appear here as soon as someone asks to collect an item."
                      action={{
                        label: 'Refresh',
                        variant: 'outline',
                        onClick: () => void fetchAdminData(),
                      }}
                    />
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="transition-colors hover:bg-muted/40">
                    <td className={cn(TD, 'whitespace-nowrap')}>
                      <span className="font-medium text-foreground">
                        {claim.claimType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={cn(TD, 'min-w-[12rem]')}>
                      <span className="block max-w-[14rem] truncate text-foreground/85">
                        {claim.item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Item status: {claim.item.status}
                      </span>
                    </td>
                    <td className={TD}>
                      <span className="block max-w-[12rem] truncate text-foreground/85">
                        {claim.user.name || claim.user.email}
                      </span>
                      {claim.user.name && (
                        <span className="block max-w-[12rem] truncate text-xs text-muted-foreground">
                          {claim.user.email}
                        </span>
                      )}
                    </td>
                    <td className={cn(TD, 'hidden md:table-cell')}>
                      <span
                        className="block max-w-[20rem] truncate text-muted-foreground"
                        title={claim.message}
                      >
                        {claim.message}
                      </span>
                    </td>
                    <td className={cn(TD, 'hidden whitespace-nowrap sm:table-cell')}>
                      <span
                        className="text-muted-foreground"
                        title={absoluteDate(claim.createdAt)}
                      >
                        {relativeDate(claim.createdAt)}
                      </span>
                    </td>
                    <td className={TD}>
                      <Badge
                        variant={
                          claim.status === 'APPROVED' ? 'default' :
                          claim.status === 'REJECTED' ? 'destructive' : 'secondary'
                        }
                      >
                        {claim.status}
                      </Badge>
                    </td>
                    <td className={cn(TD, 'text-right')}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => window.open(`/item/${claim.item.id}`, '_blank')}
                          aria-label={`View ${claim.item.title} in a new tab`}
                          title="View item"
                        >
                          <Package className="size-4" aria-hidden="true" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => window.open(`/dashboard?user=${claim.user.id}`, '_blank')}
                          aria-label={`Open the profile of ${claim.user.name || claim.user.email}`}
                          title="View claimant"
                        >
                          <UserRound className="size-4" aria-hidden="true" />
                        </Button>

                        {claim.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled
                              aria-label="Approve claim — not available yet"
                              title="Claim review is not available yet"
                            >
                              <CheckCircle className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled
                              aria-label="Reject claim — not available yet"
                              title="Claim review is not available yet"
                            >
                              <XCircle className="size-4" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={listPage.claims}
          totalPages={listPages.claims}
          onPageChange={(next) => setListPage((current) => ({ ...current, claims: next }))}
          total={listTotal.claims}
        />
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8" role="status" aria-label="Checking your permissions">
          <div className="space-y-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-6 border-b border-border pb-3">
            {TABS.map((tab) => (
              <Skeleton key={tab.id} className="h-4 w-16" />
            ))}
          </div>
          <span className="sr-only">Checking your permissions…</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={<ShieldAlert className="text-destructive" aria-hidden="true" />}
          title="Access denied"
          description="You don't have permission to access the admin dashboard."
          action={{
            label: 'Back to your dashboard',
            variant: 'outline',
            onClick: () => router.push('/dashboard'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* PageHeader draws no rule of its own here: the tab strip is the rule. */}
      <PageHeader
        className="border-b-0 pb-0"
        title="Admin dashboard"
        description={`Welcome back, ${session?.user?.name || session?.user?.email}. Manage your campus community.`}
      />

      <div
        role="tablist"
        aria-label="Admin sections"
        className="mt-8 flex gap-6 overflow-x-auto border-b border-border"
      >
        {TABS.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`admin-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`admin-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        key={activeTab}
        role="tabpanel"
        id={`admin-panel-${activeTab}`}
        aria-labelledby={`admin-tab-${activeTab}`}
        className="rise-in mt-8"
      >
        {renderPanel()}
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-modal-title"
            className="card-surface w-full max-w-sm p-6"
          >
            <h2 id="role-modal-title" className="text-xl font-semibold tracking-tight text-foreground">
              Change user role
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {selectedUser.name || selectedUser.email}
            </p>

            {/* A div, not a p: Badge renders a div and a p cannot contain one. */}
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              Current role
              <Badge variant="outline">{selectedUser.role}</Badge>
            </div>

            <div className="mt-5">
              <label
                htmlFor="new-role-select"
                className="block text-sm font-medium text-foreground"
              >
                Select new role
              </label>
              <select
                id="new-role-select"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value)}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <option value="" disabled>
                  Choose a role…
                </option>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                {session?.user?.role === 'ADMIN' && <option value="ADMIN">ADMIN</option>}
              </select>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newRole) {
                    showError('Please select a role');
                    return;
                  }

                  if (newRole === selectedUser.role) {
                    showError('User already has this role');
                    return;
                  }

                  void handleRoleChange(selectedUser.id, newRole);
                }}
                className="flex-1"
                disabled={moderatingUser === selectedUser.id}
              >
                {moderatingUser === selectedUser.id ? 'Changing…' : 'Change role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
