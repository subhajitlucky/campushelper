'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';

/** A campus zone as returned by `GET /api/zones`. */
export interface CampusMapZone {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  /** Normalised percentage (0-100) on the schematic map, not a real coordinate. */
  mapX: number;
  mapY: number;
  sortOrder?: number;
  itemCount: number;
  lostCount: number;
  foundCount: number;
}

interface CampusMapProps {
  zones: CampusMapZone[];
  selectedSlug?: string | null;
  onSelectZone: (slug: string | null) => void;
  className?: string;
}

/** Pin radius floor, in CSS pixels. Used as-is for zones with no items. */
const MIN_RADIUS = 7;
/** Pin radius for the busiest observed zone, in CSS pixels. */
const MAX_RADIUS = 19;
/** Below this radius a count would not fit inside the pin. */
const COUNT_MIN_RADIUS = 11;
/** Plot inset as a fraction of the panel, clamped, so pins and labels never
 * touch the map edge without eating the whole drawing on a narrow panel. */
const PAD_X_RATIO = 0.045;
const PAD_Y_RATIO = 0.055;
/** Label type step. One pixel smaller on the narrow mobile panel. */
const LABEL_SIZE = 12;
const LABEL_SIZE_NARROW = 11;
const LABEL_NARROW_WIDTH = 560;
const COUNT_SIZE = 11;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface LabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: LabelBox, b: LabelBox) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/**
 * Pin radius for a zone's item count.
 *
 * Scaling by the square root of the share keeps the *area* of the pin roughly
 * proportional to the number of items, so a zone with four times the items is
 * visibly twice as wide rather than four times. The ends are pinned to
 * {@link MIN_RADIUS}-{@link MAX_RADIUS} so an empty zone is still clickable and
 * a single busy zone cannot swallow the map.
 */
function pinRadius(itemCount: number, maxItemCount: number): number {
  if (maxItemCount <= 0) return MIN_RADIUS;
  const share = Math.max(itemCount, 0) / maxItemCount;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(Math.min(share, 1));
}

interface MapSize {
  width: number;
  height: number;
}

/**
 * Measures the map panel and reports its pixel box.
 *
 * The map is drawn on a 1-unit-per-CSS-pixel canvas (the viewBox *is* the
 * measured box), which is what lets pins, labels and stroke widths keep a
 * constant on-screen size in both the wide desktop panel and the tall mobile
 * one. A fixed viewBox would either letterbox the drawing inside the panel or
 * stretch every pin into an ellipse.
 */
function useMapSize(ref: RefObject<HTMLDivElement | null>): MapSize {
  const [size, setSize] = useState<MapSize>({ width: 640, height: 400 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(240, Math.round(rect.width));
      const height = Math.max(200, Math.round(rect.height));
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * CampusMap Component
 *
 * Inline SVG schematic map of the campus zones. Deliberately dependency-free:
 * no map library, no tiles, no API key — `mapX`/`mapY` are percentages on this
 * drawing, not geographic coordinates.
 *
 * Every zone is a real interactive element (`role="button"`, focusable, Enter
 * and Space activate it) with its counts in the accessible name, and the legend
 * is overlaid inside the bottom-left corner so the map itself stays the hero.
 *
 * Colour comes from semantic tokens only, so the same shapes read on a light
 * ground and a dark one: the ground is `muted`, roads are cut in `background`,
 * pins are `muted-foreground` (selected: `info`) with `info-foreground` /
 * `background` counts, and the lost/found ring uses `destructive` / `success`.
 */
export default function CampusMap({
  zones,
  selectedSlug = null,
  onSelectZone,
  className
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const size = useMapSize(containerRef);
  const gridId = useId();

  if (zones.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-2 bg-muted px-6 text-center',
          className
        )}
      >
        <MapPin className="size-8 text-muted-foreground/70" aria-hidden="true" />
        <p className="text-base font-medium text-foreground">No campus zones yet</p>
        <p className="text-base text-muted-foreground">
          Zones appear here once they have been configured.
        </p>
      </div>
    );
  }

  const { width, height } = size;
  const maxItemCount = zones.reduce((max, zone) => Math.max(max, zone.itemCount), 0);

  const padX = clamp(width * PAD_X_RATIO, 22, 54);
  const padY = clamp(height * PAD_Y_RATIO, 24, 40);
  const labelSize = width < LABEL_NARROW_WIDTH ? LABEL_SIZE_NARROW : LABEL_SIZE;

  const plotX = (mapX: number) =>
    padX + clamp(mapX, 0, 100) / 100 * Math.max(width - padX * 2, 1);
  const plotY = (mapY: number) =>
    padY + clamp(mapY, 0, 100) / 100 * Math.max(height - padY * 2, 1);

  // Decorative road network, derived from the panel box so it fills any shape.
  const roads = [
    `M 0 ${height * 0.42} H ${width * 0.58} Q ${width * 0.68} ${height * 0.42} ${
      width * 0.72
    } ${height * 0.56} L ${width * 0.82} ${height}`,
    `M ${width * 0.06} ${height * 0.94} Q ${width * 0.26} ${height * 0.62} ${
      width * 0.5
    } ${height * 0.58} L ${width} ${height * 0.46}`,
    `M ${width * 0.5} 0 V ${height * 0.36}`
  ];

  const contours = [
    `M 0 ${height * 0.7} Q ${width * 0.3} ${height * 0.52} ${width * 0.62} ${height * 0.64} T ${width} ${
      height * 0.6
    }`,
    `M 0 ${height * 0.24} Q ${width * 0.34} ${height * 0.14} ${width * 0.78} ${height * 0.28}`
  ];

  const handleSelect = (slug: string) => {
    // The map reports the zone that was activated; the parent owns selection
    // state and therefore also decides whether a second activation clears it.
    onSelectZone(slug);
  };

  const handleKeyDown = (event: React.KeyboardEvent<SVGGElement>, slug: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(slug);
    }
  };

  const geometry = new Map(
    zones.map((zone) => {
      const radius = pinRadius(zone.itemCount, maxItemCount);
      return [
        zone.slug,
        {
          cx: plotX(zone.mapX),
          cy: plotY(zone.mapY),
          radius,
          ringRadius: radius + 3.5,
          circumference: 2 * Math.PI * (radius + 3.5),
          lostShare: zone.itemCount > 0 ? zone.lostCount / zone.itemCount : 0
        }
      ] as const;
    })
  );

  /**
   * Zone labels are placed once, in priority order — the selected zone first,
   * then the busiest — under their pin, flipped above when the bottom of the
   * drawing would clip them, and dropped when they would still collide with a
   * label already placed. A crowded mobile panel therefore loses a couple of
   * names rather than printing overlapping text; the zone names are still in
   * each pin's accessible name and in the selected-zone panel.
   */
  const labelBoxes: LabelBox[] = [];
  const labels = new Map<string, { x: number; y: number } | null>();

  for (const zone of [...zones].sort(
    (a, b) =>
      Number(b.slug === selectedSlug) - Number(a.slug === selectedSlug) ||
      b.itemCount - a.itemCount
  )) {
    const { cx, cy, radius } = geometry.get(zone.slug)!;
    const boxWidth = zone.name.length * labelSize * 0.58 + 10;
    const x = clamp(cx, boxWidth / 2 + 4, Math.max(width - boxWidth / 2 - 4, boxWidth / 2 + 4));
    const below = cy + radius + labelSize + 2;
    const above = cy - radius - 6;
    const candidates =
      below + 4 <= height && below - labelSize - 2 >= 0 ? [below, above] : [above, below];

    let placement: { x: number; y: number } | null = null;

    for (const y of candidates) {
      if (y - labelSize - 2 < 0 || y + 4 > height) continue;
      const box: LabelBox = {
        left: x - boxWidth / 2,
        right: x + boxWidth / 2,
        top: y - labelSize - 2,
        bottom: y + 4
      };
      if (!labelBoxes.some((placed) => overlaps(placed, box))) {
        labelBoxes.push(box);
        placement = { x, y };
        break;
      }
    }

    labels.set(zone.slug, placement);
  }

  // The selected zone is painted last so its halo and label sit above the rest.
  const orderedZones = [...zones].sort(
    (a, b) => Number(a.slug === selectedSlug) - Number(b.slug === selectedSlug)
  );

  return (
    <div ref={containerRef} className={cn('relative h-full w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        role="group"
        aria-label="Schematic campus map. Select a zone to see the items reported there."
      >
        <defs>
          <pattern id={gridId} width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1" className="fill-muted-foreground/25" />
          </pattern>
        </defs>

        {/* Campus ground: a faint dot grid, contoured, so the panel reads as a
            drawing rather than an empty box in either theme. */}
        <rect x="0" y="0" width={width} height={height} className="fill-muted" />
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={`url(#${gridId})`}
          aria-hidden="true"
        />

        <g
          aria-hidden="true"
          fill="none"
          className="stroke-muted-foreground/12"
          strokeWidth="1.1"
        >
          {contours.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Roads cut into the ground: a hairline casing in `border` with the
            ground colour laid back over it, which reads as two quiet edges in
            both themes and never competes with the pins. */}
        <g aria-hidden="true" fill="none" strokeLinecap="round">
          {roads.map((d) => (
            <path key={`casing-${d}`} d={d} className="stroke-border" strokeWidth="10" />
          ))}
          {roads.map((d) => (
            <path key={`surface-${d}`} d={d} className="stroke-muted" strokeWidth="7.5" />
          ))}
        </g>

        {orderedZones.map((zone) => {
          const isSelected = zone.slug === selectedSlug;
          const { cx, cy, radius, ringRadius, circumference, lostShare } = geometry.get(zone.slug)!;
          const readableCountLabel = `${zone.itemCount} ${zone.itemCount === 1 ? 'item' : 'items'}`;
          const accessibleName = `${zone.name} — ${readableCountLabel} (${zone.lostCount} lost, ${zone.foundCount} found)`;
          const isEmpty = zone.itemCount === 0;
          const label = labels.get(zone.slug) ?? null;

          return (
            <g
              key={zone.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={accessibleName}
              onClick={() => handleSelect(zone.slug)}
              onKeyDown={(event) => handleKeyDown(event, zone.slug)}
              className="group/zone cursor-pointer"
            >
              <title>{accessibleName}</title>

              {/* Selected halo — a soft wash of the accent under the marker. */}
              {isSelected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius + 13}
                  aria-hidden="true"
                  className="fill-info/15"
                />
              )}

              {/* Selection ring (also the focus ring) */}
              <circle
                cx={cx}
                cy={cy}
                r={radius + 8}
                className={cn(
                  'fill-none',
                  isSelected ? 'stroke-info' : 'stroke-transparent',
                  'group-focus-visible/zone:stroke-ring'
                )}
                strokeWidth="1.5"
              />

              {/* Lost/found share ring */}
              {zone.itemCount > 0 && (
                <g aria-hidden="true" transform={`rotate(-90 ${cx} ${cy})`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={ringRadius}
                    className="fill-none stroke-success"
                    strokeWidth="2.5"
                  />
                  {lostShare > 0 && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={ringRadius}
                      className="fill-none stroke-destructive"
                      strokeWidth="2.5"
                      strokeDasharray={`${lostShare * circumference} ${circumference}`}
                    />
                  )}
                </g>
              )}

              {/* Pin */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                className={cn(
                  'transition-colors',
                  isSelected
                    ? 'fill-info stroke-info'
                    : 'fill-muted-foreground stroke-muted-foreground/70 group-hover/zone:fill-foreground'
                )}
                strokeWidth="1"
              />

              {/* Count inside pins large enough to hold it. The text colour is
                  the pin's own foreground token, so it reads in both themes. */}
              {radius >= COUNT_MIN_RADIUS && (
                <text
                  x={cx}
                  y={cy + COUNT_SIZE * 0.36}
                  textAnchor="middle"
                  aria-hidden="true"
                  fontSize={COUNT_SIZE}
                  className={cn(
                    'pointer-events-none font-medium tabular-nums',
                    isSelected ? 'fill-info-foreground' : 'fill-background'
                  )}
                >
                  {zone.itemCount}
                </text>
              )}

              {/* Zone label, haloed so it stays legible over roads and grid */}
              {label && (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  aria-hidden="true"
                  fontSize={labelSize}
                  paintOrder="stroke"
                  strokeWidth="3.5"
                  className={cn(
                    'pointer-events-none stroke-card font-medium',
                    isSelected
                      ? 'fill-info'
                      : isEmpty
                        ? 'fill-muted-foreground/70'
                        : 'fill-muted-foreground'
                  )}
                >
                  {zone.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend — overlaid inside the map, bottom-left, so the drawing is never
          pushed down the page by its own key. */}
      <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-card backdrop-blur-sm">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-3 rounded-full border-2 border-destructive"
              aria-hidden="true"
            />
            Lost
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-success" aria-hidden="true" />
            Found
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-muted-foreground" />
              <span className="size-2.5 rounded-full bg-muted-foreground" />
              <span className="size-3.5 rounded-full bg-muted-foreground" />
            </span>
            Pin size = items
          </li>
        </ul>

        <p className="mt-1.5 border-t border-border-subtle pt-1.5 text-xs text-muted-foreground">
          Schematic map — not to scale.
        </p>
      </div>
    </div>
  );
}
