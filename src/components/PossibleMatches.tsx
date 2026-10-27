'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import SectionHeader from '@/components/ui/SectionHeader';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError, showSuccess } from '@/lib/toast-config';
import { cn } from '@/lib/utils';

/**
 * Possible LOST/FOUND counterparts for an item.
 *
 * Only rendered for the item's poster, because suggestions are derived from the
 * full description and are only actionable by the person who filed the report.
 * Each suggestion shows *why* it was paired so the user can judge it rather
 * than trusting a bare percentage.
 *
 * Containerless like the rest of the page (brief §4.1): a `SectionHeader` draws
 * the rule, and rows are separated by dividers rather than boxed.
 */

interface MatchReason {
  code: string;
  label: string;
  weight: number;
}

interface MatchCounterpart {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  location: string;
  images: string[];
  status: string;
  createdAt: string;
}

interface MatchView {
  id: string;
  score: number;
  reasons: MatchReason[];
  status: 'SUGGESTED' | 'DISMISSED' | 'CONFIRMED';
  counterpart: MatchCounterpart;
}

interface PossibleMatchesProps {
  itemId: string;
  className?: string;
}

function scoreTone(score: number): string {
  if (score >= 80) return 'bg-success/10 text-success border-success/30';
  if (score >= 65) return 'bg-info/10 text-info border-info/30';
  return 'bg-warning/10 text-warning border-warning/30';
}

/** Compact "3 days ago" style label; falls back to an empty string if unparseable. */
function relativeDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const days = Math.floor((Date.now() - then) / 86_400_000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

export default function PossibleMatches({ itemId, className }: PossibleMatchesProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/items/${itemId}/matches`);

      // 403 simply means the viewer is not the poster: nothing to show.
      if (!response.ok) {
        setMatches([]);
        return;
      }

      const data = await response.json();
      setMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch {
      // Suggestions are a bonus, never an error the user must see.
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (matchId: string, action: 'dismiss' | 'confirm') => {
      setPendingId(matchId);

      try {
        const response = await fetchWithAuth(`/api/matches/${matchId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? 'Could not update this suggestion.');
        }

        setMatches((previous) =>
          previous.map((match) =>
            match.id === matchId
              ? { ...match, status: action === 'dismiss' ? 'DISMISSED' : 'CONFIRMED' }
              : match
          )
        );

        showSuccess(
          action === 'dismiss'
            ? 'Match dismissed.'
            : 'Match confirmed. Use the claim flow to arrange the handover.'
        );
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Something went wrong.');
      } finally {
        setPendingId(null);
      }
    },
    [fetchWithAuth]
  );

  if (hidden || isLoading || matches.length === 0) return null;

  // Dismissing is optimistic, so the dismissed row must disappear immediately
  // rather than linger until the next reload.
  const visibleMatches = matches.filter((match) => match.status !== 'DISMISSED');

  if (visibleMatches.length === 0) return null;

  return (
    <section className={className} aria-labelledby="possible-matches-heading">
      <SectionHeader
        id="possible-matches-heading"
        title={visibleMatches.length === 1 ? 'Possible match' : 'Possible matches'}
        description="These reports look like they could describe the same item."
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setHidden(true)}
            aria-label="Hide possible matches"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        }
      />

      <ul className="mt-6 divide-y divide-border-subtle">
        {visibleMatches.map((match) => {
          const isPending = pendingId === match.id;

          return (
            <li key={match.id} className="py-5 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    scoreTone(match.score)
                  )}
                >
                  {match.score}% match
                </span>
                <span className="rounded-full border border-border-subtle bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {match.counterpart.itemType === 'FOUND' ? 'Found report' : 'Lost report'}
                </span>
                {match.status === 'CONFIRMED' && (
                  <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Confirmed
                  </span>
                )}
              </div>

              <Link
                href={`/item/${match.counterpart.id}`}
                className="mt-3 block rounded text-base font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {match.counterpart.title}
              </Link>

              <p className="mt-1 line-clamp-2 text-base text-foreground/85">
                {match.counterpart.description}
              </p>

              {(match.counterpart.location || relativeDate(match.counterpart.createdAt)) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {match.counterpart.location}
                  {match.counterpart.location && relativeDate(match.counterpart.createdAt) && ' · '}
                  {relativeDate(match.counterpart.createdAt)}
                </p>
              )}

              {match.reasons.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Why these were paired">
                  {match.reasons.map((reason) => (
                    <li
                      key={reason.code}
                      className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/85"
                      title={`Contributes ${reason.weight} points`}
                    >
                      {reason.label}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/item/${match.counterpart.id}`}>View report</Link>
                </Button>

                {match.status !== 'CONFIRMED' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={isPending}
                    onClick={() => void act(match.id, 'confirm')}
                  >
                    This is the same item
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="quiet"
                  disabled={isPending}
                  onClick={() => void act(match.id, 'dismiss')}
                >
                  Not a match
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
