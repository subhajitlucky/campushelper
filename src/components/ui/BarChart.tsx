'use client';

import { cn } from '@/lib/utils';

/**
 * Dependency-free grouped bar chart drawn as inline SVG.
 *
 * The app has no charting library and this dashboard needs one small chart, so
 * hand-rolling it avoids pulling in a large dependency for a single view. Bars
 * are rendered from data, and every bar carries a `<title>` so hovering gives
 * the exact figure.
 */

export interface BarChartSeries {
  key: string;
  label: string;
  className: string;
  values: number[];
}

interface BarChartProps {
  /** One label per x position, e.g. `2026-10-18`. */
  labels: readonly string[];
  series: readonly BarChartSeries[];
  height?: number;
  /** Formats a value for the accessible title and axis maximum. */
  formatValue?: (value: number) => string;
  className?: string;
  ariaLabel?: string;
}

const PADDING = { top: 8, right: 8, bottom: 4, left: 8 };

export default function BarChart({
  labels,
  series,
  height = 160,
  formatValue = (value) => String(value),
  className,
  ariaLabel = 'Bar chart',
}: BarChartProps) {
  const pointCount = labels.length;
  const maxValue = Math.max(
    1,
    ...series.flatMap((entry) => entry.values.slice(0, pointCount))
  );

  if (pointCount === 0 || series.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No data for this range.</p>;
  }

  const viewWidth = 100;
  const viewHeight = 100;
  const plotWidth = viewWidth - PADDING.left - PADDING.right;
  const plotHeight = viewHeight - PADDING.top - PADDING.bottom;

  const slotWidth = plotWidth / pointCount;
  const groupGap = slotWidth * 0.2;
  const barWidth = Math.max((slotWidth - groupGap) / series.length, 0.4);

  return (
    <figure className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Baseline */}
        <line
          x1={PADDING.left}
          y1={viewHeight - PADDING.bottom}
          x2={viewWidth - PADDING.right}
          y2={viewHeight - PADDING.bottom}
          stroke="#e5e7eb"
          strokeWidth={0.4}
        />

        {labels.map((label, pointIndex) => {
          const slotStart = PADDING.left + pointIndex * slotWidth + groupGap / 2;

          return (
            <g key={`${label}-${pointIndex}`}>
              {series.map((entry, seriesIndex) => {
                const value = entry.values[pointIndex] ?? 0;
                const scaled = (value / maxValue) * plotHeight;
                const x = slotStart + seriesIndex * barWidth;
                const y = viewHeight - PADDING.bottom - scaled;

                return (
                  <rect
                    key={entry.key}
                    x={x}
                    y={y}
                    width={Math.max(barWidth - 0.15, 0.3)}
                    height={Math.max(scaled, value > 0 ? 0.4 : 0)}
                    className={entry.className}
                    rx={0.3}
                  >
                    <title>{`${label} · ${entry.label}: ${formatValue(value)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-3">
          {series.map((entry) => (
            <li key={entry.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={cn('h-2.5 w-2.5 rounded-sm', entry.className)} aria-hidden="true" />
              {entry.label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          {labels[0]} → {labels[labels.length - 1]} · peak {formatValue(maxValue)}
        </p>
      </div>
    </figure>
  );
}
