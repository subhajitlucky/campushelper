'use client';

import { cn } from '@/lib/utils';

/**
 * Dependency-free grouped bar chart drawn as inline SVG.
 *
 * The app has no charting library and this dashboard needs one small chart, so
 * hand-rolling it avoids pulling in a large dependency for a single view. Bars
 * are rendered from data, and every bar carries a `<title>` so hovering gives
 * the exact figure.
 *
 * Design notes:
 * - The plot area *is* the axis range, so the value ticks line up with the
 *   gridlines exactly. Text is rendered as HTML beside the SVG rather than as
 *   `<text>` inside it, because `preserveAspectRatio="none"` (what lets the
 *   chart fill any width) would stretch any glyph drawn inside the viewBox.
 * - Every colour is a semantic token: series fills arrive as `fill-*` utilities
 *   and the legend swatch is derived from the same class, so light and dark mode
 *   are handled by the theme rather than by this component.
 */

export interface BarChartSeries {
  key: string;
  label: string;
  /**
   * Fill for the bars, written as a token utility — `fill-primary`,
   * `fill-success`, `fill-info`. The legend swatch reuses the same token by
   * swapping `fill-` for `bg-`, so a series can never be one colour in the plot
   * and another in the key.
   */
  className: string;
  values: number[];
}

interface BarChartProps {
  /** One label per x position, e.g. `2026-10-18`. */
  labels: readonly string[];
  series: readonly BarChartSeries[];
  height?: number;
  /** Formats a value for the accessible title, the value axis and the peak. */
  formatValue?: (value: number) => string;
  /** Formats an x-axis tick. Defaults to a short locale date for ISO labels. */
  formatLabel?: (label: string, index: number) => string;
  className?: string;
  ariaLabel?: string;
}

/** More ticks than this and the axis turns into unreadable mush. */
const MAX_X_TICKS = 7;

function defaultFormatLabel(label: string) {
  const date = new Date(label);

  if (Number.isNaN(date.getTime())) {
    return label;
  }

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Evenly spaced tick positions, anchored to the most recent point. */
function xTickIndices(pointCount: number): number[] {
  if (pointCount <= MAX_X_TICKS) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }

  const step = Math.ceil(pointCount / MAX_X_TICKS);
  const indices: number[] = [];

  for (let index = pointCount - 1; index >= 0; index -= step) {
    indices.unshift(index);
  }

  return indices;
}

/** `fill-primary` → `bg-primary`, so the key and the bars share one token. */
function legendSwatchClassName(fillClassName: string) {
  return fillClassName.replace(/\bfill-/, 'bg-');
}

const TICK_LABEL = 'absolute right-0 text-xs leading-none tabular-nums text-muted-foreground';

export default function BarChart({
  labels,
  series,
  height = 160,
  formatValue = (value) => String(value),
  formatLabel = defaultFormatLabel,
  className,
  ariaLabel = 'Bar chart',
}: BarChartProps) {
  const pointCount = labels.length;

  if (pointCount === 0 || series.length === 0) {
    return (
      <p className="py-10 text-center text-base text-muted-foreground">No data for this range.</p>
    );
  }

  // A flat range must not invent a peak. `Math.max(1, …)` used to make an
  // all-zero series report "peak 1"; the scale only falls back to 1 to keep the
  // ratio finite, and the footer reports what the data actually says.
  const dataMax = Math.max(
    0,
    ...series.flatMap((entry) =>
      entry.values
        .slice(0, pointCount)
        .map((value) => (Number.isFinite(value) ? Math.max(value, 0) : 0))
    )
  );
  const hasData = dataMax > 0;
  const scaleMax = hasData ? dataMax : 1;

  const viewWidth = 100;
  const viewBoxHeight = 100;
  const baseline = viewBoxHeight;

  // A single label per point when the range is short; otherwise an evenly
  // spaced subset so 30 or 90 days do not collide.
  const slotWidth = viewWidth / pointCount;
  const groupGap = slotWidth * 0.22;
  const barWidth = Math.max((slotWidth - groupGap) / series.length, 0.4);

  const midValue = Math.round(dataMax / 2);
  const showMidValue = hasData && midValue > 0 && midValue < dataMax;
  const ticks = xTickIndices(pointCount);

  const totals = series.map((entry) =>
    entry.values
      .slice(0, pointCount)
      .reduce((sum, value) => sum + (Number.isFinite(value) ? Math.max(value, 0) : 0), 0)
  );

  return (
    <figure className={cn('w-full', className)}>
      <div className="flex gap-3 pb-1.5">
        {/* Value axis. Absolutely positioned so each label's centre sits on its
            gridline instead of on the edge of a flex row. */}
        <div className="relative w-9 shrink-0" style={{ height }} aria-hidden="true">
          <span className={cn(TICK_LABEL, 'top-0 -translate-y-1/2')}>
            {formatValue(dataMax)}
          </span>
          {showMidValue && (
            <span className={cn(TICK_LABEL, 'top-1/2 -translate-y-1/2')}>
              {formatValue(midValue)}
            </span>
          )}
          <span className={cn(TICK_LABEL, 'bottom-0 translate-y-1/2')}>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${viewWidth} ${viewBoxHeight}`}
            preserveAspectRatio="none"
            style={{ height }}
            className="block w-full"
            role="img"
            aria-label={ariaLabel}
          >
            {[0, 0.5, 1].map((fraction) => (
              <line
                key={fraction}
                x1={0}
                x2={viewWidth}
                y1={fraction * viewBoxHeight}
                y2={fraction * viewBoxHeight}
                className={fraction === 1 ? 'stroke-border' : 'stroke-border-subtle'}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {labels.map((label, pointIndex) => {
              const slotStart = pointIndex * slotWidth + groupGap / 2;

              return (
                <g key={`${label}-${pointIndex}`}>
                  {series.map((entry, seriesIndex) => {
                    const raw = entry.values[pointIndex] ?? 0;
                    const value = Number.isFinite(raw) ? Math.max(raw, 0) : 0;
                    const scaled = (value / scaleMax) * viewBoxHeight;
                    // Zero stays flat; a non-zero value keeps a hairline so a
                    // single busy day inside a quiet range is still visible.
                    const barHeight = value > 0 ? Math.max(scaled, 0.6) : 0;

                    return (
                      <rect
                        key={entry.key}
                        x={slotStart + seriesIndex * barWidth}
                        y={baseline - barHeight}
                        width={Math.max(barWidth - 0.12, 0.3)}
                        height={barHeight}
                        className={entry.className}
                        rx={0.4}
                      >
                        <title>{`${label} · ${entry.label}: ${formatValue(value)}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Ticks are placed at each slot's centre, so a label sits under the
              bar it describes rather than merely being spread edge to edge.
              Every other tick drops out below `sm`, where a narrow chart cannot
              fit six dates without them colliding; the most recent date stays. */}
          <div className="relative mt-1.5 h-4 text-xs leading-none tabular-nums text-muted-foreground">
            {ticks.map((index, tickIndex) => {
              const crowdedOut =
                ticks.length > 4 && tickIndex % 2 === 1 && index !== pointCount - 1;

              return (
                <span
                  key={index}
                  className={cn(
                    'absolute top-0 -translate-x-1/2 whitespace-nowrap',
                    crowdedOut && 'hidden sm:block'
                  )}
                  style={{ left: `${((index + 0.5) / pointCount) * 100}%` }}
                >
                  {formatLabel(labels[index], index)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border-subtle pt-3">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((entry) => (
            <li
              key={entry.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className={cn('size-2.5 rounded-sm', legendSwatchClassName(entry.className))}
                aria-hidden="true"
              />
              {entry.label}
            </li>
          ))}
        </ul>

        <p className="text-xs tabular-nums text-muted-foreground">
          {hasData ? `Peak ${formatValue(dataMax)}` : 'No activity in this range'}
        </p>
      </figcaption>

      {/* The chart is a single image to a screen reader, so the figures it
          encodes are also stated as text. */}
      <p className="sr-only">
        {series
          .map((entry, index) => `${entry.label} total ${formatValue(totals[index])}`)
          .join('. ')}
      </p>
    </figure>
  );
}
