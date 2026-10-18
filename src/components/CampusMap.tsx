'use client';

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

/** Pin radius floor. Used as-is for zones with no items. */
const MIN_RADIUS = 3;
/** Pin radius for the busiest observed zone. */
const MAX_RADIUS = 8;

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

/**
 * CampusMap Component
 *
 * Inline SVG schematic map of the campus zones. Deliberately dependency-free:
 * no map library, no tiles, no API key — `mapX`/`mapY` are percentages on this
 * drawing, not geographic coordinates.
 *
 * Every zone is a real interactive element (`role="button"`, focusable, Enter
 * and Space activate it) with its counts in the accessible name.
 */
export default function CampusMap({
  zones,
  selectedSlug = null,
  onSelectZone,
  className
}: CampusMapProps) {
  if (zones.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-10 text-sm text-gray-500',
          className
        )}
      >
        No campus zones configured
      </div>
    );
  }

  const maxItemCount = zones.reduce((max, zone) => Math.max(max, zone.itemCount), 0);

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

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox="0 0 100 100"
        className="block h-auto w-full"
        role="group"
        aria-label="Schematic campus map. Select a zone to see the items reported there."
      >
        {/* Campus ground */}
        <rect
          x="1"
          y="1"
          width="98"
          height="98"
          rx="6"
          className="fill-gray-100 stroke-gray-300"
          strokeWidth="0.5"
        />

        {/* Decorative roads */}
        <g aria-hidden="true" className="stroke-gray-200" fill="none" strokeLinecap="round">
          <path d="M4 42 H60 Q68 42 70 48 L76 90" strokeWidth="3" />
          <path d="M8 88 Q24 62 48 56 L96 46" strokeWidth="2.5" />
          <path d="M52 4 V34" strokeWidth="2" />
        </g>
        <g aria-hidden="true" className="stroke-white" fill="none" strokeLinecap="round">
          <path d="M4 42 H60 Q68 42 70 48 L76 90" strokeWidth="0.4" strokeDasharray="2 2" />
          <path d="M8 88 Q24 62 48 56 L96 46" strokeWidth="0.4" strokeDasharray="2 2" />
        </g>

        {zones.map((zone) => {
          const isSelected = zone.slug === selectedSlug;
          const radius = pinRadius(zone.itemCount, maxItemCount);
          const readableCountLabel = `${zone.itemCount} ${zone.itemCount === 1 ? 'item' : 'items'}`;
          const accessibleName = `${zone.name} — ${readableCountLabel} (${zone.lostCount} lost, ${zone.foundCount} found)`;

          // Lost/found split drawn as a ring of two arcs. The circumference is
          // known, so a dash array avoids any path maths.
          const ringRadius = radius + 1.4;
          const circumference = 2 * Math.PI * ringRadius;
          const lostShare = zone.itemCount > 0 ? zone.lostCount / zone.itemCount : 0;

          return (
            <g
              key={zone.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={accessibleName}
              onClick={() => handleSelect(zone.slug)}
              onKeyDown={(event) => handleKeyDown(event, zone.slug)}
              className="group/zone cursor-pointer opacity-90 transition-opacity hover:opacity-100 focus-visible:opacity-100"
            >
              <title>{accessibleName}</title>

              {/* Selection ring (also the focus ring) */}
              <circle
                cx={zone.mapX}
                cy={zone.mapY}
                r={ringRadius + 1.6}
                className={cn(
                  'fill-none group-focus-visible/zone:stroke-blue-400',
                  isSelected ? 'stroke-blue-300' : 'stroke-transparent'
                )}
                strokeWidth="1"
              />

              {/* Lost/found share ring */}
              {zone.itemCount > 0 && (
                <g aria-hidden="true" transform={`rotate(-90 ${zone.mapX} ${zone.mapY})`}>
                  <circle
                    cx={zone.mapX}
                    cy={zone.mapY}
                    r={ringRadius}
                    className="fill-none stroke-green-500"
                    strokeWidth="1.2"
                  />
                  {lostShare > 0 && (
                    <circle
                      cx={zone.mapX}
                      cy={zone.mapY}
                      r={ringRadius}
                      className="fill-none stroke-red-500"
                      strokeWidth="1.2"
                      strokeDasharray={`${lostShare * circumference} ${circumference}`}
                    />
                  )}
                </g>
              )}

              {/* Pin */}
              <circle
                cx={zone.mapX}
                cy={zone.mapY}
                r={radius}
                className={cn(
                  'transition-colors',
                  isSelected
                    ? 'fill-blue-600 stroke-blue-800'
                    : 'fill-gray-400 stroke-gray-500 group-hover/zone:fill-gray-500'
                )}
                strokeWidth="0.6"
              />

              {/* Count inside pins large enough to hold it */}
              {radius >= 5 && (
                <text
                  x={zone.mapX}
                  y={zone.mapY + 1.4}
                  textAnchor="middle"
                  aria-hidden="true"
                  className="pointer-events-none fill-white text-[3.6px] font-semibold"
                >
                  {zone.itemCount}
                </text>
              )}

              {/* Zone label */}
              <text
                x={zone.mapX}
                y={zone.mapY + radius + 4.4}
                textAnchor="middle"
                aria-hidden="true"
                className={cn(
                  'pointer-events-none text-[2.9px] font-medium',
                  isSelected ? 'fill-blue-700' : 'fill-gray-600'
                )}
              >
                {zone.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-red-500" aria-hidden="true" />
          Lost
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-green-500" aria-hidden="true" />
          Found
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-400" aria-hidden="true" />
          Pin size = number of items
        </span>
        <span className="text-gray-500">Schematic map — not to scale.</span>
      </div>
    </div>
  );
}
