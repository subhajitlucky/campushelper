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
 * is the step that proves the item actually changed hands: the poster shows the
 * code, the claimer enters it, and only then is the item marked returned.
 *
 * The two roles are deliberately split. The endpoint gives the six digits to
 * the poster only; the claimer sees that a code exists and enters it. A
 * moderator can see the status but cannot read the code, issue one, or complete
 * the handover.
 *
 * Three states, each with one tone: issued (warning — time-limited, action
 * needed), verified (success), expired or exhausted (destructive).
 */

interface HandoverState {
  status: string;
  hasCode: boolean;
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

function HandoverMeta({
  id,
  expiresAt,
  attemptsRemaining,
}: {
  id: string;
  expiresAt: string | null;
  attemptsRemaining: number;
}) {
  const expiry = formatExpiry(expiresAt);

  return (
    <p
      id={id}
      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
    >
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      {expiry && <>{expiry} · </>}
      {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
    </p>
  );
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

          // The hint line shows the budget and the code may have been burned
          // by this attempt, so reload the authoritative state as well.
          void load();

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
        throw new Error(data.error ?? 'Could not issue a new code.');
      }

      showSuccess('A new handover code has been issued. Show it to the claimer when you meet.');
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

  // No usable code: the attempt budget is gone, the code expired, or no code
  // was ever issued. Only the poster can replace it, because only the poster
  // can read the replacement.
  if (handover.exhausted || handover.expired || !handover.hasCode) {
    const isDead = handover.exhausted || handover.expired;
    const guidance = handover.isPoster
      ? 'Issue a new code and show it to the claimer when you meet.'
      : handover.isClaimer
        ? 'Ask the poster to issue a new code, then enter it here.'
        : 'Only the poster can issue a new code.';

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

        <p className="mt-2 text-sm text-muted-foreground">{guidance}</p>

        {handover.isPoster && (
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
        )}
      </div>
    );
  }

  const hintId = `handover-hint-${claimId}`;
  const errorId = `handover-error-${claimId}`;

  // The claimer receives the item, so they are the one who enters the code.
  if (handover.isClaimer) {
    return (
      <div className={cn('rounded-xl border border-warning/30 bg-warning/10 p-4', className)}>
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <h3 className="text-base font-medium text-foreground">Enter the handover code</h3>
        </div>

        <p className="mt-1.5 text-base leading-relaxed text-foreground/85">
          Ask the poster to show you the code when the item is handed over, then enter it here.
        </p>

        <HandoverMeta
          id={hintId}
          expiresAt={handover.expiresAt}
          attemptsRemaining={handover.attemptsRemaining}
        />

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

  // The poster hands over the item and shows the code. They must not be able
  // to complete the handover alone, so no verification form is rendered.
  if (handover.isPoster) {
    return (
      <div className={cn('rounded-xl border border-warning/30 bg-warning/10 p-4', className)}>
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <h3 className="text-base font-medium text-foreground">Show this code to the claimer</h3>
        </div>

        <p className="mt-1.5 text-base leading-relaxed text-foreground/85">
          Show this code only when you hand over the item. The claimer enters it to confirm.
        </p>

        {handover.code && (
          <p
            className="mt-4 select-all font-mono text-3xl tracking-[0.3em] text-foreground"
            aria-label={`Handover code ${handover.code.split('').join(' ')}`}
          >
            {handover.code}
          </p>
        )}

        <HandoverMeta
          id={hintId}
          expiresAt={handover.expiresAt}
          attemptsRemaining={handover.attemptsRemaining}
        />
      </div>
    );
  }

  // A moderator (or another entitled viewer) can see the status but cannot
  // read the code or act on it.
  return (
    <div className={cn('rounded-xl border border-warning/30 bg-warning/10 p-4', className)}>
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 shrink-0 text-warning" aria-hidden="true" />
        <h3 className="text-base font-medium text-foreground">Handover in progress</h3>
      </div>

      <p className="mt-1.5 text-base leading-relaxed text-foreground/85">
        A handover code is active. Only the poster and the claimer can complete this handover.
      </p>

      <HandoverMeta
        id={hintId}
        expiresAt={handover.expiresAt}
        attemptsRemaining={handover.attemptsRemaining}
      />
    </div>
  );
}
