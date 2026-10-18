'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
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
  if (score >= 80) return 'bg-green-50 text-green-700 border-green-200';
  if (score >= 65) return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
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

  return (
    <section
      className={cn(
        'bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden',
        className
      )}
      aria-labelledby="possible-matches-heading"
    >
      <header className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h2 id="possible-matches-heading" className="font-medium text-gray-900">
              Possible {matches.length === 1 ? 'match' : 'matches'}
            </h2>
            <p className="text-sm text-gray-600">
              These reports look like they could describe the same item.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded p-1 text-gray-500 transition-colors hover:bg-blue-100 hover:text-gray-700"
          aria-label="Hide possible matches"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <ul className="divide-y divide-gray-100">
        {matches.map((match) => {
          const isPending = pendingId === match.id;

          return (
            <li key={match.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs font-medium',
                    scoreTone(match.score)
                  )}
                >
                  {match.score}% match
                </span>
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {match.counterpart.itemType === 'FOUND' ? 'Found report' : 'Lost report'}
                </span>
                {match.status === 'CONFIRMED' && (
                  <span className="flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Confirmed
                  </span>
                )}
              </div>

              <Link
                href={`/item/${match.counterpart.id}`}
                className="mt-2 block font-medium text-gray-900 transition-colors hover:text-blue-700"
              >
                {match.counterpart.title}
              </Link>

              <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                {match.counterpart.description}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {match.counterpart.location}
                {relativeDate(match.counterpart.createdAt) &&
                  ` · ${relativeDate(match.counterpart.createdAt)}`}
              </p>

              {match.reasons.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Why these were paired">
                  {match.reasons.map((reason) => (
                    <li
                      key={reason.code}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                      title={`Contributes ${reason.weight} points`}
                    >
                      {reason.label}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex gap-2">
                <Link
                  href={`/item/${match.counterpart.id}`}
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  View report
                </Link>

                {match.status !== 'CONFIRMED' && (
                  <button
                    type="button"
                    onClick={() => void act(match.id, 'confirm')}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                    This is the same item
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void act(match.id, 'dismiss')}
                  disabled={isPending}
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  Not a match
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
