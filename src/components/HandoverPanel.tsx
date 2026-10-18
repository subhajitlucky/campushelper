'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError, showSuccess } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

/**
 * Handover verification panel for an approved claim.
 *
 * A claim being approved only means the poster believed the claimer. This panel
 * is the step that proves the item actually changed hands: one party reads out
 * the code, the other enters it, and only then is the item marked returned.
 *
 * The code is fetched from a dedicated endpoint that authorises the claimer,
 * the item poster, and moderators only.
 */

interface HandoverState {
  status: string;
  code: string | null;
  expiresAt: string | null;
  attemptsRemaining: number;
  expired: boolean;
  exhausted: boolean;
  isClaimer: boolean;
  isPoster: boolean;
}

interface HandoverPanelProps {
  claimId: string;
  /** Called after a successful verification so the parent can refresh. */
  onVerified?: () => void;
  className?: string;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return '';
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';

  const hours = Math.max(Math.ceil((at - Date.now()) / 3_600_000), 0);
  if (hours === 0) return 'expires within the hour';
  if (hours === 1) return 'expires in 1 hour';
  if (hours < 48) return `expires in ${hours} hours`;

  return `expires in ${Math.ceil(hours / 24)} days`;
}

export default function HandoverPanel({ claimId, onVerified, className }: HandoverPanelProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [handover, setHandover] = useState<HandoverState | null>(null);
  const [entry, setEntry] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/claims/${claimId}/handover`);

      if (!response.ok) {
        setHandover(null);
        return;
      }

      const data = await response.json();
      setHandover(data.handover ?? null);
    } catch {
      setHandover(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setIsSubmitting(true);

      try {
        const response = await fetchWithAuth(`/api/claims/${claimId}/handover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: entry.trim() }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          // Surface the remaining-attempts budget, which the API includes.
          const remaining = data?.details?.attemptsRemaining;
          const suffix =
            typeof remaining === 'number' ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : '';
          throw new Error(`${data.error ?? 'Verification failed.'}${suffix}`);
        }

        showSuccess(data.message ?? 'Handover verified.');
        setEntry('');
        await load();
        onVerified?.();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Verification failed.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [claimId, entry, fetchWithAuth, load, onVerified]
  );

  const reissue = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetchWithAuth(`/api/claims/${claimId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reissue: true }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? 'Could not re-issue a code.');
      }

      showSuccess('A new handover code has been issued to both parties.');
      await load();
    } catch (reissueError) {
      showError(reissueError instanceof Error ? reissueError.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }, [claimId, fetchWithAuth, load]);

  if (isLoading || !handover) return null;

  // Nothing to do until the claim is approved.
  if (handover.status === 'PENDING' || handover.status === 'REJECTED') return null;

  if (handover.status === 'COMPLETED') {
    return (
      <div
        className={cn(
          'rounded-lg border border-success/30 bg-success/10 p-4',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
          <p className="font-medium text-success">Handover verified</p>
        </div>
        <p className="mt-1 text-sm text-success">
          The item has been marked as returned to its owner.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-info/30 bg-info/10 p-4', className)}>
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-medium text-primary">Handover verification</h3>
      </div>

      {handover.code ? (
        <>
          <p className="mt-2 text-sm text-primary">
            {handover.isClaimer
              ? 'Read this code to the other party when you receive the item. Do not share it before then.'
              : 'Enter this code when the item is physically handed over.'}
          </p>

          <p
            className="mt-3 select-all font-mono text-3xl font-bold tracking-[0.3em] text-primary"
            aria-label={`Handover code ${handover.code.split('').join(' ')}`}
          >
            {handover.code}
          </p>

          <p className="mt-1 flex items-center gap-1 text-xs text-primary">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatExpiry(handover.expiresAt)} · {handover.attemptsRemaining} attempt
            {handover.attemptsRemaining === 1 ? '' : 's'} remaining
          </p>

          <form onSubmit={submit} className="mt-3 space-y-2">
            <label htmlFor={`handover-${claimId}`} className="block text-sm font-medium text-primary">
              Enter the code to confirm the handover
            </label>
            <div className="flex gap-2">
              <input
                id={`handover-${claimId}`}
                value={entry}
                onChange={(changeEvent) => {
                  // Keep it numeric and bounded so the field cannot hold junk.
                  setEntry(changeEvent.target.value.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-invalid={Boolean(error)}
                className="w-32 rounded-lg border border-info/30 px-3 py-2 font-mono tracking-widest focus:border-ring focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={isSubmitting || entry.length !== 6}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                Verify
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="mt-2">
          <p className="flex items-start gap-2 text-sm text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {handover.exhausted
              ? 'Too many incorrect attempts were made, so the code is no longer valid.'
              : 'There is no active code for this claim right now.'}
          </p>

          <button
            type="button"
            onClick={() => void reissue()}
            disabled={isSubmitting}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-info/30 bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-info/90/10 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Issue a new code
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
