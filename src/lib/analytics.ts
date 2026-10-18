/**
 * Pure derivations over the aggregates the admin impact dashboard needs.
 *
 * Callers pass already-computed counts, buckets and durations, so nothing here
 * touches Prisma or I/O and every function stays safe on empty input.
 */

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Round to a fixed number of decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

/** Clamp a value into an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Median hours-to-return, which resists a single stale item in a way a mean
 * cannot. Negative and non-finite durations are discarded; null when nothing
 * usable remains.
 */
export function medianTimeToReturnHours(durationsHours: readonly number[]): number | null {
  const usable = durationsHours.filter((hours) => Number.isFinite(hours) && hours >= 0);

  if (usable.length === 0) {
    return null;
  }

  const sorted = [...usable].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;

  return roundTo(median, 1);
}

/** Share of posted items that reached a resolved state, as a 0..1 ratio. */
export function resolutionRate(resolvedCount: number, totalCount: number): number {
  if (!Number.isFinite(resolvedCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
    return 0;
  }

  return roundTo(clamp(resolvedCount / totalCount, 0, 1), 4);
}

/** Percentage for one funnel stage, zeroed when the stage has no base. */
function stagePercentage(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return roundTo(clamp((numerator / denominator) * 100, 0, 100), 1);
}

/**
 * Claims funnel conversion percentages, each measured against its own base so
 * a drop-off at one stage never distorts the others.
 */
export function funnelPercentages(
  created: number,
  approved: number,
  completed: number
): { createdToApproved: number; approvedToCompleted: number; createdToCompleted: number } {
  return {
    createdToApproved: stagePercentage(approved, created),
    approvedToCompleted: stagePercentage(completed, approved),
    createdToCompleted: stagePercentage(completed, created),
  };
}

/** UTC-midnight timestamp for an ISO date or timestamp, or null if unparseable. */
function toUtcDay(iso: string): number | null {
  const parsed = Date.parse(iso);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const day = new Date(parsed);

  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

/** `YYYY-MM-DD` label for a UTC-midnight timestamp. */
function toDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * One bucket per UTC calendar day across an inclusive range, zero-filled where
 * the caller supplied no aggregate. Reversed or unparseable ranges yield [].
 */
export function fillDailySeries(
  points: readonly { date: string; posted: number; resolved: number }[],
  startISO: string,
  endISO: string
): { date: string; posted: number; resolved: number }[] {
  const start = toUtcDay(startISO);
  const end = toUtcDay(endISO);

  if (start === null || end === null || start > end) {
    return [];
  }

  const supplied = new Map<string, { posted: number; resolved: number }>();
  for (const point of points) {
    supplied.set(point.date.slice(0, 10), { posted: point.posted, resolved: point.resolved });
  }

  const series: { date: string; posted: number; resolved: number }[] = [];

  for (let day = start; day <= end; day += MS_PER_DAY) {
    const date = toDayKey(day);
    const point = supplied.get(date);

    series.push({
      date,
      posted: point?.posted ?? 0,
      resolved: point?.resolved ?? 0,
    });
  }

  return series;
}

/**
 * Human-readable duration for dashboards: minutes under an hour, hours under
 * two days, then days — with an em dash when the value is unknown.
 */
export function formatDuration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) {
    return '—';
  }

  const safeHours = Math.max(hours, 0);

  if (safeHours < 1) {
    const minutes = Math.round(safeHours * MINUTES_PER_HOUR);

    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  if (safeHours < HOURS_PER_DAY * 2) {
    return `${roundTo(safeHours, 1).toFixed(1)} hours`;
  }

  return `${roundTo(safeHours / HOURS_PER_DAY, 1).toFixed(1)} days`;
}
