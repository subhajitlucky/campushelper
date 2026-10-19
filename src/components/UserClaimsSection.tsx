'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import SectionHeader from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';

interface UserClaim {
  id: string;
  claimType: 'FOUND_IT' | 'OWN_IT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message: string | null;
  itemId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  item: {
    id: string;
    title: string;
  };
}

interface UserClaimsSectionProps {
  userId: string;
}

const CLAIM_TYPE_LABEL: Record<UserClaim['claimType'], string> = {
  FOUND_IT: 'You found this item',
  OWN_IT: 'You reported this as yours',
};

const STATUS_LABEL: Record<UserClaim['status'], string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * The pill geometry is written out rather than delegated to `<Badge>`: that
 * component spreads `props` after its `className`, so any caller that passes a
 * className silently loses the variant's `rounded-full border px-2.5` base. A
 * status chip should keep its shape no matter which colours it is given.
 */
const PILL = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold';

/** Same colour contract as `StatusBadge`, applied to claim states. */
const STATUS_CLASSES: Record<UserClaim['status'], string> = {
  PENDING: `${PILL} border-warning/30 bg-warning/10 text-warning`,
  APPROVED: `${PILL} border-success/30 bg-success/10 text-success`,
  REJECTED: `${PILL} border-destructive/30 bg-destructive/10 text-destructive`,
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ClaimRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul
      className="mt-6 divide-y divide-border-subtle"
      role="status"
      aria-label="Loading your claims"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex items-start justify-between gap-6 py-5">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0" />
        </li>
      ))}
      <span className="sr-only">Loading…</span>
    </ul>
  );
}

/**
 * The "My claims" tab panel.
 *
 * Claims are records in a list, not objects you browse, so they are rows: a
 * title, the message, one meta line, and quiet actions — separated by
 * `divide-border-subtle` rather than wrapped in per-claim bordered boxes inside
 * a Card. The previous version nested a `border rounded-lg p-4` row per claim
 * inside a card, which is three levels of container for two lines of text.
 */
export default function UserClaimsSection({ userId }: UserClaimsSectionProps) {
  const [claims, setClaims] = useState<UserClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserClaims = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch claims made by this user
      const response = await fetch(`/api/claims?userId=${userId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch your claims');
      }

      const data = await response.json();
      setClaims(data.claims || []);
    } catch {
      setError('Failed to load your claims. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Handle cancel claim (placeholder for future implementation)
  const handleCancelClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to cancel this claim?')) {
      return;
    }

    try {
      // TODO: Implement cancel claim API endpoint
      // Cancel claim initiated
      // For now, just remove from local state
      setClaims((prev) => prev.filter((claim) => claim.id !== claimId));
    } catch {
      setError('Failed to cancel claim. Please try again.');
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserClaims();
    }
  }, [userId, fetchUserClaims]);

  const header = (description: string, showBrowse: boolean) => (
    <SectionHeader
      title="Your claims"
      description={description}
      divider={false}
      action={
        showBrowse ? (
          <Button variant="quiet" size="sm" asChild>
            <Link href="/search">
              <Search className="mr-1.5 size-4" aria-hidden="true" />
              Find something to claim
            </Link>
          </Button>
        ) : undefined
      }
    />
  );

  // Loading state
  if (loading) {
    return (
      <section aria-label="Your claims">
        {header('Claims you have made on items.', false)}
        <ClaimRowsSkeleton />
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section aria-label="Your claims">
        {header('Claims you have made on items.', false)}
        <EmptyState
          icon={<MessageSquare />}
          title="Your claims could not be loaded"
          description={error}
          action={{ label: 'Try again', onClick: fetchUserClaims }}
        />
      </section>
    );
  }

  // Empty state
  if (claims.length === 0) {
    return (
      <section aria-label="Your claims">
        {header('Claims you have made on items.', false)}
        <EmptyState
          icon={<MessageSquare />}
          title="No claims made yet"
          description="Found something that belongs to someone else? Open the report and claim it."
          action={{
            label: 'Browse items to claim',
            onClick: () => {
              window.location.href = '/search';
            },
          }}
        />
      </section>
    );
  }

  return (
    <section aria-label="Your claims">
      {header(
        `${claims.length} claim${claims.length === 1 ? '' : 's'} submitted.`,
        true
      )}

      <ul className="mt-6 divide-y divide-border-subtle">
        {claims.map((claim) => (
          <li
            key={claim.id}
            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link
                  href={`/item/${claim.itemId}`}
                  className="text-base font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {claim.item.title}
                </Link>
                <span className={STATUS_CLASSES[claim.status]}>
                  {STATUS_LABEL[claim.status]}
                </span>
              </div>

              {claim.message && (
                <p className="mt-2 max-w-2xl text-base text-foreground/85">{claim.message}</p>
              )}

              <p className="mt-2 text-sm text-muted-foreground">
                {CLAIM_TYPE_LABEL[claim.claimType]}
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                Claimed <time dateTime={claim.createdAt}>{formatDate(claim.createdAt)}</time>
                {claim.resolvedAt && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    Resolved <time dateTime={claim.resolvedAt}>{formatDate(claim.resolvedAt)}</time>
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button variant="quiet" size="sm" asChild>
                <Link href={`/item/${claim.itemId}`}>View item</Link>
              </Button>

              {claim.status === 'PENDING' && (
                <Button
                  variant="quiet"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleCancelClaim(claim.id)}
                >
                  Cancel claim
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
