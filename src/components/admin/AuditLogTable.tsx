'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import SectionHeader from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

/**
 * Audit log viewer.
 *
 * Every privileged action is listed with who did it, to what, and why. The
 * actor's email is denormalised into each row, so history stays attributable
 * even after an account is deleted.
 *
 * Presented as a real table (brief §4.7): one line per action, filters inline in
 * the header row, a header that stays put while the log scrolls, and monospace
 * identifiers so an id can be compared at a glance.
 */

/**
 * Exported because the Overview tab renders the six most recent of these; both
 * tabs must agree on what an audit entry is and how an action is labelled.
 */
export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string; avatar: string | null } | null;
}

export const ACTION_LABELS: Record<string, string> = {
  ITEM_FLAG: 'Flagged item',
  ITEM_REMOVE: 'Removed item',
  ITEM_RESTORE: 'Restored item',
  ITEM_DELETE: 'Deleted item',
  USER_ROLE_CHANGE: 'Changed role',
  USER_DEACTIVATE: 'Deactivated user',
  USER_REACTIVATE: 'Reactivated user',
  CLAIM_OVERRIDE: 'Overrode claim',
  BULK_ITEM_ACTION: 'Bulk item action',
  BULK_USER_ACTION: 'Bulk user action',
};

const ACTION_TONES: Record<string, string> = {
  ITEM_REMOVE: 'bg-destructive/10 text-destructive border-destructive/30',
  ITEM_DELETE: 'bg-destructive/10 text-destructive border-destructive/30',
  USER_DEACTIVATE: 'bg-destructive/10 text-destructive border-destructive/30',
  ITEM_FLAG: 'bg-warning/10 text-warning border-warning/30',
  ITEM_RESTORE: 'bg-success/10 text-success border-success/30',
  USER_REACTIVATE: 'bg-success/10 text-success border-success/30',
};

const TH =
  'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-background px-3 py-2.5 text-left text-xs font-medium text-muted-foreground';
const TD = 'border-b border-border-subtle px-3 py-3 align-middle';
const FIELD =
  'rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Compact relative time; the exact timestamp sits beside it in the row. */
function relativeTime(iso: string) {
  const then = new Date(iso);
  const elapsedMinutes = Math.round((Date.now() - then.getTime()) / 60000);

  if (!Number.isFinite(elapsedMinutes)) return '';

  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function absoluteTime(iso: string) {
  const then = new Date(iso);

  return Number.isNaN(then.getTime()) ? iso : then.toLocaleString();
}

export default function AuditLogTable({ className }: { className?: string }) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Only the newest request may write state; a slow earlier page or filter
  // response must not render under the current selection.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSeq.current;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (action) params.set('action', action);
      if (targetType) params.set('targetType', targetType);

      const response = await fetchWithAuth(`/api/admin/audit?${params.toString()}`);

      if (requestId !== requestSeq.current) return;

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not load the audit log.');
      }

      const data = await response.json();

      if (requestId !== requestSeq.current) return;

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (error) {
      if (requestId !== requestSeq.current) return;

      showError(error instanceof Error ? error.message : 'Could not load the audit log.');
      setEntries([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (requestId === requestSeq.current) {
        setIsLoading(false);
      }
    }
  }, [action, fetchWithAuth, page, targetType]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters = action !== '' || targetType !== '';

  return (
    <div className={cn('space-y-6', className)}>
      <SectionHeader
        divider={false}
        title="Audit log"
        description={
          isLoading
            ? 'Newest first.'
            : `${total} ${total === 1 ? 'entry' : 'entries'}${hasFilters ? ' matching these filters' : ''}, newest first.`
        }
        action={
          <>
            <label className="text-sm">
              <span className="sr-only">Filter by action</span>
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
                className={FIELD}
              >
                <option value="">All actions</option>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="sr-only">Filter by target type</span>
              <select
                value={targetType}
                onChange={(event) => {
                  setTargetType(event.target.value);
                  setPage(1);
                }}
                className={FIELD}
              >
                <option value="">All targets</option>
                <option value="Item">Items</option>
                <option value="User">Users</option>
                <option value="Claim">Claims</option>
              </select>
            </label>
          </>
        }
      />

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Privileged actions, newest first, with actor, target and reason.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                When
              </th>
              <th scope="col" className={TH}>
                Actor
              </th>
              <th scope="col" className={TH}>
                Action
              </th>
              <th scope="col" className={TH}>
                Target
              </th>
              <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className={TD}>
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className={TD}>
                    <Skeleton className="h-4 w-36" />
                  </td>
                  <td className={TD}>
                    <Skeleton className="h-5 w-24 rounded-md" />
                  </td>
                  <td className={TD}>
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className={cn(TD, 'hidden lg:table-cell')}>
                    <Skeleton className="h-4 w-40" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="border-b border-border-subtle">
                  {hasFilters ? (
                    <EmptyState
                      icon={<ScrollText aria-hidden="true" />}
                      title="No entries match these filters"
                      description="Nothing in the audit log matches the action and target you selected."
                      action={{
                        label: 'Clear filters',
                        variant: 'outline',
                        onClick: () => {
                          setAction('');
                          setTargetType('');
                          setPage(1);
                        },
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={<ScrollText aria-hidden="true" />}
                      title="No privileged actions recorded"
                      description="Moderation actions on items, users and claims appear here as soon as they happen."
                    />
                  )}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-muted/40">
                  <td className={cn(TD, 'whitespace-nowrap')}>
                    <span className="block text-foreground/85">{relativeTime(entry.createdAt)}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {absoluteTime(entry.createdAt)}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="block text-foreground">
                      {entry.actor?.name || entry.actorEmail}
                    </span>
                    <span className="block text-xs text-muted-foreground">{entry.actorEmail}</span>
                  </td>
                  <td className={cn(TD, 'whitespace-nowrap')}>
                    <span
                      className={cn(
                        'inline-block rounded-md border px-2 py-0.5 text-xs font-medium',
                        ACTION_TONES[entry.action] ?? 'border-border bg-muted/40 text-foreground/85'
                      )}
                    >
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="block text-foreground/85">{entry.targetType}</span>
                    <span className="block max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
                      {entry.targetId}
                    </span>
                  </td>
                  <td className={cn(TD, 'hidden lg:table-cell')}>
                    <span
                      className="block max-w-[24rem] truncate text-muted-foreground"
                      title={entry.reason ?? undefined}
                    >
                      {entry.reason ?? '—'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        total={total}
      />
    </div>
  );
}
