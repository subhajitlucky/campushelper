'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, TrendingUp } from 'lucide-react';
import BarChart from '@/components/ui/BarChart';
import EmptyState from '@/components/ui/EmptyState';
import SectionHeader from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError } from '@/lib/toast-config';
import { cn } from '@/lib/utils';
import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/schemas/analytics';

/**
 * Impact dashboard: resolution rate, median time-to-return, daily volume, and
 * the claims funnel.
 *
 * Medians rather than means are reported for time-to-return, because one stale
 * item left unresolved for months would drag a mean into nonsense.
 *
 * Structure follows the redesign brief §4.7: the four headline figures are a
 * plain numbers strip (no boxes around each number), and each chart is a
 * section separated by a rule and whitespace rather than nested in its own
 * bordered container.
 */

interface AnalyticsResponse {
  range: AnalyticsRange;
  generatedAt: string;
  totals: { posted: number; resolved: number; resolutionRate: number };
  medianTimeToReturnHours: number | null;
  medianTimeToReturnLabel: string;
  dailySeries: { date: string; posted: number; resolved: number }[];
  topZones: { id: string; name: string; count: number }[];
  topCategories: { id: string; name: string; count: number }[];
  claimsFunnel: {
    createdToApproved: number;
    approvedToCompleted: number;
    createdToCompleted: number;
  };
  activeUsers: number;
}

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

export interface StatStripItem {
  label: string;
  value: string;
  hint?: string;
}

/**
 * The shared headline numbers strip: label, figure, optional one-line hint.
 * Deliberately boxless — a number does not need a container to be legible, and
 * four bordered tiles out-shout the figures they hold.
 */
export function StatsStrip({
  items,
  className,
}: {
  items: readonly StatStripItem[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
            {item.value}
            {item.hint && (
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {item.hint}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FunnelBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-foreground/85">{label}</span>
        <span className="text-sm font-medium tabular-nums text-foreground">{percent}%</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * A ranked list with a proportion bar per row. The bar carries the comparison —
 * which is the only reason the list is here — so the numbers can stay quiet.
 */
function RankList({ entries }: { entries: readonly { id: string; name: string; count: number }[] }) {
  const max = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <ul className="mt-3 divide-y divide-border-subtle">
      {entries.map((entry) => (
        <li key={entry.id} className="py-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate text-sm text-foreground/85">{entry.name}</span>
            <span className="text-sm tabular-nums text-muted-foreground">{entry.count}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${(entry.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading analytics">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function AnalyticsPanel({ className }: { className?: string }) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetchWithAuth(`/api/admin/analytics?range=${range}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not load analytics.');
      }

      setData(await response.json());
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not load analytics.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = useCallback(
    async (report: 'items' | 'claims') => {
      setIsExporting(report);

      try {
        const response = await fetchWithAuth(`/api/admin/export/${report}`);

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'Export failed.');
        }

        // Fetching through fetchWithAuth keeps CSRF/auth handling consistent,
        // then the blob is handed to the browser as a download.
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `campushelper-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Export failed.');
      } finally {
        setIsExporting(null);
      }
    },
    [fetchWithAuth]
  );

  return (
    <div className={cn('space-y-10', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1"
          role="group"
          aria-label="Reporting range"
        >
          {ANALYTICS_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                range === option
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/85'
              )}
            >
              {RANGE_LABELS[option]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportCsv('items')}
            disabled={isExporting !== null}
          >
            {isExporting === 'items' ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-2 size-4" aria-hidden="true" />
            )}
            Export items
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportCsv('claims')}
            disabled={isExporting !== null}
          >
            {isExporting === 'claims' ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-2 size-4" aria-hidden="true" />
            )}
            Export claims
          </Button>
        </div>
      </div>

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : !data ? (
        <EmptyState
          icon={<TrendingUp className="text-muted-foreground" aria-hidden="true" />}
          title="No analytics for this range"
          description="Nothing could be measured for the selected window. Try a wider range."
          action={{ label: 'Try again', onClick: () => void load(), variant: 'outline' }}
        />
      ) : (
        <>
          <StatsStrip
            items={[
              { label: 'Items posted', value: String(data.totals.posted) },
              { label: 'Items returned', value: String(data.totals.resolved) },
              {
                label: 'Resolution rate',
                value: `${(data.totals.resolutionRate * 100).toFixed(1)}%`,
              },
              {
                label: 'Median time to return',
                value: data.medianTimeToReturnLabel,
                hint: 'Median, so one stale item cannot skew it',
              },
            ]}
          />

          <section aria-labelledby="analytics-daily-volume">
            <SectionHeader
              as="h3"
              id="analytics-daily-volume"
              title="Daily volume"
              description={`Reports posted and returns confirmed, ${RANGE_LABELS[range].toLowerCase()}.`}
            />
            <div className="mt-4">
              <BarChart
                labels={data.dailySeries.map((point) => point.date)}
                series={[
                  {
                    key: 'posted',
                    label: 'Posted',
                    className: 'fill-primary',
                    values: data.dailySeries.map((point) => point.posted),
                  },
                  {
                    key: 'resolved',
                    label: 'Returned',
                    className: 'fill-success',
                    values: data.dailySeries.map((point) => point.resolved),
                  },
                ]}
                ariaLabel="Items posted and returned per day"
              />
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <section aria-labelledby="analytics-funnel">
              <SectionHeader
                as="h3"
                id="analytics-funnel"
                title="Claims funnel"
                description="A claim only completes once a handover code is verified in person."
              />
              <div className="mt-4 space-y-4">
                <FunnelBar label="Claims approved" percent={data.claimsFunnel.createdToApproved} />
                <FunnelBar
                  label="Approved claims completed"
                  percent={data.claimsFunnel.approvedToCompleted}
                />
                <FunnelBar
                  label="Created to completed"
                  percent={data.claimsFunnel.createdToCompleted}
                />
              </div>
            </section>

            <section aria-labelledby="analytics-places">
              <SectionHeader
                as="h3"
                id="analytics-places"
                title="Where things turn up"
                description="Reports by campus zone and by category."
              />

              <h4 className="mt-4 text-xs font-medium text-muted-foreground">Top locations</h4>
              {data.topZones.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No zone data in this range.</p>
              ) : (
                <RankList entries={data.topZones} />
              )}

              <h4 className="mt-6 text-xs font-medium text-muted-foreground">Top categories</h4>
              {data.topCategories.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No category data in this range.
                </p>
              ) : (
                <RankList entries={data.topCategories} />
              )}
            </section>
          </div>

          <p className="text-xs text-muted-foreground">
            {data.activeUsers} active user{data.activeUsers === 1 ? '' : 's'} signed in during
            this range.
          </p>
        </>
      )}
    </div>
  );
}
