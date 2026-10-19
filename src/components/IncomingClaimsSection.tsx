'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, MessageSquare, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import SectionHeader from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthFetch } from '@/lib/auth-fetch';
import HandoverPanel from '@/components/HandoverPanel';

interface IncomingClaim {
  id: string;
  claimType: 'FOUND_IT' | 'OWN_IT';
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
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

interface IncomingClaimsSectionProps {
  userId: string;
  /** Switch the dashboard to the "My items" tab — used by the empty state. */
  onGoToItems?: () => void;
}

/**
 * The pill geometry is written out rather than delegated to `<Badge>`: that
 * component spreads `props` after its `className`, so a caller that passes a
 * className loses the variant's `rounded-full border px-2.5` base.
 */
const PILL = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold';

const CLAIM_TYPE_LABEL: Record<IncomingClaim['claimType'], string> = {
  FOUND_IT: 'Found the item',
  OWN_IT: 'Says it is theirs',
};

const RESOLVED_STATUS_CLASSES: Record<IncomingClaim['status'], string> = {
  PENDING: `${PILL} border-warning/30 bg-warning/10 text-warning`,
  APPROVED: `${PILL} border-success/30 bg-success/10 text-success`,
  COMPLETED: `${PILL} border-info/30 bg-info/10 text-info`,
  REJECTED: `${PILL} border-destructive/30 bg-destructive/10 text-destructive`,
};

const RESOLVED_STATUS_LABEL: Record<IncomingClaim['status'], string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  /** An approved claim whose handover code has been exchanged. */
  COMPLETED: 'Returned',
  REJECTED: 'Rejected',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function claimerName(claim: IncomingClaim): string {
  return claim.user.name || claim.user.email;
}

function IncomingRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul
      className="mt-6 divide-y divide-border-subtle"
      role="status"
      aria-label="Loading incoming claims"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex flex-wrap items-start justify-between gap-6 py-5">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </li>
      ))}
      <span className="sr-only">Loading…</span>
    </ul>
  );
}

/**
 * The "Incoming claims" tab panel — claims other students have made on the
 * signed-in user's reports.
 *
 * The approve/reject contract is unchanged (`PUT /api/claims/[id]` with the
 * claim's new status, one in-flight claim at a time), as is `HandoverPanel`: an
 * approved claim still renders it so the handover code can be exchanged before
 * the item counts as returned. What changed is the surface — pending claims are
 * rows separated by a hairline, with one filled primary action (Approve) and
 * quiet text actions beside it, instead of amber bordered boxes inside a Card.
 */
export default function IncomingClaimsSection({ userId, onGoToItems }: IncomingClaimsSectionProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [claims, setClaims] = useState<IncomingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null);

  const fetchIncomingClaims = async () => {
    try {
      setLoading(true);
      setError(null);

      // First fetch user's items
      const itemsResponse = await fetch(`/api/items?postedById=${userId}&limit=100`, {
        credentials: 'include',
      });
      if (!itemsResponse.ok) {
        throw new Error('Failed to fetch your items');
      }

      const itemsData = await itemsResponse.json();
      const userItems = itemsData.items || [];

      if (userItems.length === 0) {
        setClaims([]);
        return;
      }

      // Extract item IDs
      const itemIds = userItems.map((item: { id: string }) => item.id);

      // Fetch claims for all user's items
      const claimsPromises = itemIds.map(async (itemId: string) => {
        try {
          const response = await fetch(`/api/claims?itemId=${itemId}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            return data.claims || [];
          }
        } catch (err) {
          setError(`Error fetching claims for item ${itemId}: ${err}`);
          return [];
        }
      });

      // Wait for all claims requests to complete
      const claimsResults = await Promise.all(claimsPromises);

      // Flatten and sort claims by creation date
      const allClaims = claimsResults.flat();
      allClaims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setClaims(allClaims);
    } catch {
      setError('Failed to load incoming claims. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle approve claim
  const handleApproveClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to approve this claim? This will update the item status.')) {
      return;
    }

    setProcessingClaimId(claimId);

    try {
      const response = await fetchWithAuth(`/api/claims/${claimId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'APPROVED',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve claim');
      }

      // Update local state
      setClaims((prev) =>
        prev.map((claim) =>
          claim.id === claimId
            ? { ...claim, status: 'APPROVED', resolvedAt: new Date().toISOString() }
            : claim
        )
      );
    } catch {
      setError('Failed to approve claim. Please try again.');
    } finally {
      setProcessingClaimId(null);
    }
  };

  // Handle reject claim
  const handleRejectClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to reject this claim?')) {
      return;
    }

    setProcessingClaimId(claimId);

    try {
      const response = await fetchWithAuth(`/api/claims/${claimId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'REJECTED',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject claim');
      }

      // Update local state
      setClaims((prev) =>
        prev.map((claim) =>
          claim.id === claimId
            ? { ...claim, status: 'REJECTED', resolvedAt: new Date().toISOString() }
            : claim
        )
      );
    } catch {
      setError('Failed to reject claim. Please try again.');
    } finally {
      setProcessingClaimId(null);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchIncomingClaims();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter to show only pending claims by default
  const pendingClaims = claims.filter((claim) => claim.status === 'PENDING');
  const resolvedClaims = claims.filter((claim) => claim.status !== 'PENDING');

  const header = (description: string) => (
    <SectionHeader title="Claims on your items" description={description} divider={false} />
  );

  // Loading state
  if (loading) {
    return (
      <section aria-label="Claims on your items">
        {header('Students asking to collect your reports.')}
        <IncomingRowsSkeleton />
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section aria-label="Claims on your items">
        {header('Students asking to collect your reports.')}
        <EmptyState
          icon={<MessageSquare />}
          title="Incoming claims could not be loaded"
          description={error}
          action={{ label: 'Try again', onClick: fetchIncomingClaims }}
        />
      </section>
    );
  }

  // Empty state
  if (claims.length === 0) {
    return (
      <section aria-label="Claims on your items">
        {header('Students asking to collect your reports.')}
        <EmptyState
          icon={<MessageSquare />}
          title="No claims received yet"
          description="When someone claims one of your reports, it will appear here for you to approve."
          action={{
            label: 'See your items',
            variant: 'default',
            onClick: () => {
              if (onGoToItems) {
                onGoToItems();
              } else {
                window.location.href = '/dashboard';
              }
            },
          }}
        />
      </section>
    );
  }

  return (
    <section aria-label="Claims on your items">
      {header(
        `${pendingClaims.length} waiting on you${
          resolvedClaims.length > 0 ? ` · ${resolvedClaims.length} already decided` : ''
        }.`
      )}

      {/* Pending Claims Section */}
      {pendingClaims.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-medium text-foreground">
            Waiting on you
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {pendingClaims.length}
            </span>
          </h3>

          <ul className="mt-2 divide-y divide-border-subtle">
            {pendingClaims.map((claim) => (
              <li key={claim.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Link
                        href={`/item/${claim.itemId}`}
                        className="text-base font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {claim.item.title}
                      </Link>
                      <span className={`${PILL} border-border text-muted-foreground`}>
                        {CLAIM_TYPE_LABEL[claim.claimType]}
                      </span>
                    </div>

                    {claim.message && (
                      <p className="mt-2 max-w-2xl text-base text-foreground/85">
                        &ldquo;{claim.message}&rdquo;
                      </p>
                    )}

                    <p className="mt-2 text-sm text-muted-foreground">
                      {claimerName(claim)}
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      Claimed <time dateTime={claim.createdAt}>{formatDate(claim.createdAt)}</time>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button variant="quiet" size="sm" asChild>
                      <Link href={`/item/${claim.itemId}`}>View item</Link>
                    </Button>

                    <Button
                      size="sm"
                      variant="quiet"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRejectClaim(claim.id)}
                      disabled={processingClaimId === claim.id}
                    >
                      <XCircle className="mr-1.5 size-4" aria-hidden="true" />
                      Reject
                    </Button>

                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleApproveClaim(claim.id)}
                      disabled={processingClaimId === claim.id}
                    >
                      <CheckCircle className="mr-1.5 size-4" aria-hidden="true" />
                      {processingClaimId === claim.id ? 'Working…' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resolved Claims Section */}
      {resolvedClaims.length > 0 && (
        <div className="mt-10">
          <h3 className="text-base font-medium text-foreground">
            Already decided
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {resolvedClaims.length}
            </span>
          </h3>

          <ul className="mt-2 divide-y divide-border-subtle">
            {resolvedClaims.slice(0, 5).map((claim) => (
              <li key={claim.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/item/${claim.itemId}`}
                      className="text-base font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {claim.item.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {claimerName(claim)}
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      Claimed{' '}
                      <time dateTime={claim.createdAt}>{formatDate(claim.createdAt)}</time>
                      {claim.resolvedAt && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          Decided <time dateTime={claim.resolvedAt}>{formatDate(claim.resolvedAt)}</time>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={RESOLVED_STATUS_CLASSES[claim.status]}>
                      {RESOLVED_STATUS_LABEL[claim.status]}
                    </span>
                    <Button variant="quiet" size="sm" asChild>
                      <Link href={`/item/${claim.itemId}`}>View item</Link>
                    </Button>
                  </div>
                </div>

                {/* Approved claims need a verified handover before the item
                    counts as returned. */}
                {(claim.status === 'APPROVED' || claim.status === 'COMPLETED') && (
                  <HandoverPanel
                    claimId={claim.id}
                    className="mt-3"
                    onVerified={fetchIncomingClaims}
                  />
                )}
              </li>
            ))}
          </ul>

          {resolvedClaims.length > 5 && (
            <p className="mt-4 text-sm text-muted-foreground">
              And {resolvedClaims.length - 5} more decided claims.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
