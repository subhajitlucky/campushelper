'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ScrollText } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

/**
 * Audit log viewer.
 *
 * Every privileged action is listed with who did it, to what, and why. The
 * actor's email is denormalised into each row, so history stays attributable
 * even after an account is deleted.
 */

interface AuditEntry {
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

const ACTION_LABELS: Record<string, string> = {
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
  ITEM_REMOVE: 'bg-red-50 text-red-700 border-red-200',
  ITEM_DELETE: 'bg-red-50 text-red-700 border-red-200',
  USER_DEACTIVATE: 'bg-red-50 text-red-700 border-red-200',
  ITEM_FLAG: 'bg-amber-50 text-amber-700 border-amber-200',
  ITEM_RESTORE: 'bg-green-50 text-green-700 border-green-200',
  USER_REACTIVATE: 'bg-green-50 text-green-700 border-green-200',
};

export default function AuditLogTable({ className }: { className?: string }) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (action) params.set('action', action);
      if (targetType) params.set('targetType', targetType);

      const response = await fetchWithAuth(`/api/admin/audit?${params.toString()}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not load the audit log.');
      }

      const data = await response.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not load the audit log.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [action, fetchWithAuth, page, targetType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <ScrollText className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Audit log
          {total > 0 && <span className="text-gray-500">({total})</span>}
        </h2>

        <label className="ml-auto text-sm text-gray-600">
          <span className="sr-only">Filter by action</span>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-gray-600">
          <span className="sr-only">Filter by target type</span>
          <select
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All targets</option>
            <option value="Item">Items</option>
            <option value="User">Users</option>
            <option value="Claim">Claims</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading audit entries…
        </p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No privileged actions recorded for this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">When</th>
                <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">Actor</th>
                <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">Target</th>
                <th scope="col" className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="block text-gray-900">
                      {entry.actor?.name || entry.actorEmail}
                    </span>
                    <span className="block text-xs text-gray-500">{entry.actorEmail}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'inline-block rounded-md border px-2 py-0.5 text-xs font-medium',
                        ACTION_TONES[entry.action] ?? 'border-gray-200 bg-gray-50 text-gray-700'
                      )}
                    >
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    <span className="block">{entry.targetType}</span>
                    <span className="block truncate font-mono text-xs text-gray-400">
                      {entry.targetId}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{entry.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Audit log pagination">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
