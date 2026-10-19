'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
 *
 * Three states, each with one tone: issued (warning — time-limited, action
 * needed), verified (success), expired or exhausted (destructive).
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
          'rounded-xl border border-success/30 bg-success/10 p-4',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-base font-medium text-success">Handover verified</p>
        </div>
        <p className="mt-1 text-base leading-relaxed text-foreground/85">
          The item has been marked as returned to its owner.
        </p>
      </div>
    );
  }

  // No usable code: either the attempt budget is gone, or it expired / was never
  // issued. Both are destructive-ish; a plain "no code" state is only a warning.
  if (!handover.code) {
    const isDead = handover.exhausted || handover.expired;

    return (
      <div
        className={cn(
          'rounded-xl border p-4',
          isDead ? 'border-destructive/30 bg-destructive/10' : 'border-warning/30 bg-warning/10',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn('size-5 shrink-0', isDead ? 'text-destructive' : 'text-warning')}
            aria-hidden="true"
          />
          <p className={cn('text-base font-medium', isDead ? 'text-destructive' : 'text-warning')}>
            {handover.exhausted
              ? 'Handover code locked'
              : handover.expired
                ? 'Handover code expired'
                : 'No active handover code'}
          </p>
        </div>

        <p className="mt-1 text-base leading-relaxed text-foreground/85">
          {handover.exhausted
            ? 'Too many incorrect attempts were made, so the code is no longer valid.'
            : handover.expired
              ? 'This code has expired, so it cannot be used to confirm the handover.'
              : 'There is no active code for this claim right now.'}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          loading={isSubmitting}
          onClick={() => void reissue()}
        >
          Issue a new code
        </Button>
      </div>
    );
  }

  const hintId = `handover-hint-${claimId}`;
  const errorId = `handover-error-${claimId}`;

  return (
    <div className={cn('rounded-xl border border-warning/30 bg-warning/10 p-4', className)}>
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 shrink-0 text-warning" aria-hidden="true" />
        <h3 className="text-base font-medium text-foreground">Handover verification</h3>
      </div>

      <p className="mt-1.5 text-base leading-relaxed text-foreground/85">
        {handover.isClaimer
          ? 'Read this code to the other party when you receive the item. Do not share it before then.'
          : 'Enter this code when the item is physically handed over.'}
      </p>

      {/* The one thing this panel exists for — it gets the largest type on the
          panel, and `select-all` so it can be copied in one gesture. */}
      <p
        className="mt-4 select-all font-mono text-3xl tracking-[0.3em] text-foreground"
        aria-label={`Handover code ${handover.code.split('').join(' ')}`}
      >
        {handover.code}
      </p>

      <p id={hintId} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        {formatExpiry(handover.expiresAt)} · {handover.attemptsRemaining} attempt
        {handover.attemptsRemaining === 1 ? '' : 's'} remaining
      </p>

      <form onSubmit={submit} className="mt-4 space-y-2">
        <label
          htmlFor={`handover-${claimId}`}
          className="block text-sm font-medium text-foreground"
        >
          Enter the code to confirm the handover
        </label>

        <div className="flex flex-wrap gap-2">
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
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-center font-mono text-base tracking-widest text-foreground placeholder:text-muted-foreground focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />

          <Button
            type="submit"
            variant="success"
            loading={isSubmitting}
            disabled={entry.length !== 6}
          >
            Verify
          </Button>
        </div>
      </form>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-3 rounded-r-lg border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-base text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
