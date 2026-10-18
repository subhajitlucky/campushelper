'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, TrendingUp } from 'lucide-react';
import { useAuthFetch } from '@/lib/auth-fetch';
import { showError } from '@/lib/toast-config';
import { cn } from '@/lib/utils';
import BarChart from '@/components/ui/BarChart';
import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/schemas/analytics';

/**
 * Impact dashboard: resolution rate, median time-to-return, daily volume, and
 * the claims funnel.
 *
 * Medians rather than means are reported for time-to-return, because one stale
 * item left unresolved for months would drag a mean into nonsense.
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FunnelBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-foreground/85">{label}</span>
        <span className="text-sm font-medium tabular-nums text-foreground">{percent}%</span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
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
    <div className={cn('space-y-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Reporting range">
          {ANALYTICS_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
          <button
            type="button"
            onClick={() => void exportCsv('items')}
            disabled={isExporting !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            {isExporting === 'items' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Export items
          </button>
          <button
            type="button"
            onClick={() => void exportCsv('claims')}
            disabled={isExporting !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            {isExporting === 'claims' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Export claims
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading analytics…
        </p>
      ) : !data ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No analytics available.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Items posted" value={String(data.totals.posted)} />
            <Stat label="Items returned" value={String(data.totals.resolved)} />
            <Stat
              label="Resolution rate"
              value={`${(data.totals.resolutionRate * 100).toFixed(1)}%`}
            />
            <Stat
              label="Median time to return"
              value={data.medianTimeToReturnLabel}
              hint="Median, so one stale item cannot skew it"
            />
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              Daily volume
            </h3>
            <div className="mt-3">
              <BarChart
                labels={data.dailySeries.map((point) => point.date)}
                series={[
                  {
                    key: 'posted',
                    label: 'Posted',
                    className: 'fill-info',
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

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-foreground">Claims funnel</h3>
              <div className="mt-3 space-y-3">
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
              <p className="mt-3 text-xs text-muted-foreground">
                A claim only completes once a handover code is verified in person.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-foreground">Top locations</h3>
              {data.topZones.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No zone data in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.topZones.map((zone) => (
                    <li key={zone.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/85">{zone.name}</span>
                      <span className="tabular-nums text-foreground">{zone.count}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-5 text-sm font-medium text-foreground">Top categories</h3>
              {data.topCategories.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No category data in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.topCategories.map((category) => (
                    <li key={category.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/85">{category.name}</span>
                      <span className="tabular-nums text-foreground">{category.count}</span>
                    </li>
                  ))}
                </ul>
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
