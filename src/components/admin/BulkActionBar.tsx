'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError, showSuccess } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

/**
 * Bulk moderation bar.
 *
 * Appears once rows are selected. Bulk actions are destructive at scale, so the
 * API requires a reason for anything but a restore, and every change is
 * individually audited.
 */

export type BulkItemAction = 'FLAG' | 'REMOVE' | 'RESTORE';
export type BulkUserAction =
  | 'DEACTIVATE'
  | 'REACTIVATE'
  | 'VERIFY_STUDENT'
  | 'UNVERIFY_STUDENT';

interface BulkActionBarProps {
  target: 'items' | 'users';
  selectedIds: readonly string[];
  onClear: () => void;
  onDone: () => void;
  className?: string;
}

const ITEM_ACTIONS: { value: BulkItemAction; label: string; destructive: boolean }[] = [
  { value: 'FLAG', label: 'Flag', destructive: false },
  { value: 'REMOVE', label: 'Remove', destructive: true },
  { value: 'RESTORE', label: 'Restore', destructive: false },
];

const USER_ACTIONS: { value: BulkUserAction; label: string; destructive: boolean }[] = [
  { value: 'VERIFY_STUDENT', label: 'Verify student', destructive: false },
  { value: 'UNVERIFY_STUDENT', label: 'Unverify student', destructive: false },
  { value: 'DEACTIVATE', label: 'Deactivate', destructive: true },
  { value: 'REACTIVATE', label: 'Reactivate', destructive: false },
];

export default function BulkActionBar({
  target,
  selectedIds,
  onClear,
  onDone,
  className,
}: BulkActionBarProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [action, setAction] = useState<string>(
    target === 'items' ? 'FLAG' : 'VERIFY_STUDENT'
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (selectedIds.length === 0) return null;

  const options = target === 'items' ? ITEM_ACTIONS : USER_ACTIONS;
  const selected = options.find((option) => option.value === action);
  const reasonRequired = selected?.destructive === true || action === 'FLAG' || action === 'VERIFY_STUDENT' || action === 'UNVERIFY_STUDENT';

  const submit = async () => {
    if (reasonRequired && reason.trim().length < 3) {
      showError('Please give a reason of at least 3 characters.');
      return;
    }

    if (selected?.destructive && !window.confirm(
      `${selected.label} ${selectedIds.length} ${target}? This is recorded in the audit log.`
    )) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchWithAuth(`/api/admin/${target}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? 'Bulk action failed.');
      }

      const skipped =
        (data.notFound?.length ?? 0) +
        (data.skippedSelf?.length ?? 0) +
        (data.skippedAdmins?.length ?? 0);

      showSuccess(
        `Updated ${data.updated} ${target}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`
      );

      setReason('');
      onClear();
      onDone();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Bulk action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sm',
        className
      )}
      role="region"
      aria-label={`Bulk actions for ${selectedIds.length} selected ${target}`}
    >
      <p className="text-sm font-medium text-blue-900">
        {selectedIds.length} selected
      </p>

      <label className="text-sm text-blue-900">
        <span className="sr-only">Bulk action</span>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="rounded-md border border-blue-300 bg-white px-2 py-1.5 text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-[12rem] flex-1 text-sm text-blue-900">
        <span className="sr-only">Reason (recorded in the audit log)</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={reasonRequired ? 'Reason (required, recorded in audit log)' : 'Reason (optional)'}
          maxLength={500}
          className="w-full rounded-md border border-blue-300 px-2 py-1.5 text-sm"
        />
      </label>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Apply
      </button>

      <button
        type="button"
        onClick={onClear}
        disabled={isSubmitting}
        aria-label="Clear selection"
        className="rounded p-1.5 text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
