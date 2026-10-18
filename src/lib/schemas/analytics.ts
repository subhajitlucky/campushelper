import { z } from 'zod';

/**
 * Schemas for the admin impact dashboard and CSV exports.
 */

/** Supported reporting windows, resolved to a date range by the route. */
export const ANALYTICS_RANGES = ['7d', '30d', '90d', 'all'] as const;

export const analyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES).optional().default('30d'),
});

/** Hard cap on exported rows so an export cannot stream an unbounded result. */
export const MAX_EXPORT_ROWS = 10_000;

export const EXPORT_FORMATS = ['items', 'claims'] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

/**
 * Resolve a reporting window to an inclusive date range relative to `now`.
 *
 * `all` returns a null start so the caller applies no lower bound.
 */
export function resolveRange(
  range: AnalyticsRange,
  now: Date = new Date()
): { start: Date | null; end: Date } {
  const end = now;

  if (range === 'all') {
    return { start: null, end };
  }

  const days = Number.parseInt(range, 10);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  return { start, end };
}
