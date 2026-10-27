'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import CampusMap, { type CampusMapZone } from '@/components/CampusMap';
import ItemCard from '@/components/ui/ItemCard';
import EmptyState, { EmptyStateIcons } from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import SectionHeader from '@/components/ui/SectionHeader';
import { SkeletonCardGrid } from '@/components/ui/SkeletonCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuthFetch } from '@/lib/auth-fetch';

interface MapItem {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
  images?: string[] | null;
  category?: { slug: string; name: string; icon: string } | null;
  zone?: { slug: string; name: string } | null;
  postedBy: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

interface MapUser {
  isLoggedIn: boolean;
  userId?: string;
}

const ITEMS_PER_ZONE = 12;

/**
 * Campus map page: the schematic map is the hero, the selected zone is a right
 * rail on desktop and a bottom sheet on mobile, and the zone's reports follow
 * below.
 *
 * The map is public: zones and aggregate counts are browse data. Signed-out
 * visitors can open a report but still have to sign in to claim it.
 */
export default function MapPage() {
  const { fetchWithAuth } = useAuthFetch(false);

  const [zones, setZones] = useState<CampusMapZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesError, setZonesError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const [items, setItems] = useState<MapItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [user, setUser] = useState<MapUser>({ isLoggedIn: false });
  // Bumped by the retry button to refetch the selected zone after a failure.
  const [itemsReloadToken, setItemsReloadToken] = useState(0);

  const fetchZones = useCallback(async () => {
    setZonesLoading(true);
    try {
      const response = await fetchWithAuth('/api/zones');
      if (!response.ok) {
        throw new Error('Failed to load campus zones');
      }

      const data = await response.json();
      setZones(data.zones || []);
      setZonesError(null);
    } catch (err) {
      setZonesError(err instanceof Error ? err.message : 'Failed to load campus zones');
    } finally {
      setZonesLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  useEffect(() => {
    if (!selectedSlug) {
      setItems([]);
      setItemsTotal(0);
      setItemsError(null);
      return;
    }

    // Guards against a slow response for a previously selected zone landing
    // after a faster one and overwriting the newer list.
    let cancelled = false;

    const fetchZoneItems = async () => {
      setItemsLoading(true);
      setItemsError(null);

      try {
        const response = await fetchWithAuth(
          `/api/items?limit=${ITEMS_PER_ZONE}&zone=${encodeURIComponent(selectedSlug)}`
        );
        if (!response.ok) {
          throw new Error('Failed to load items for this zone');
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        setItems(data.items || []);
        setItemsTotal(data.pagination?.total ?? (data.items || []).length);
        setUser(data.user || { isLoggedIn: false });
      } catch (err) {
        if (!cancelled) {
          setItemsError(err instanceof Error ? err.message : 'Failed to load items for this zone');
        }
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
        }
      }
    };

    fetchZoneItems();

    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, itemsReloadToken, selectedSlug]);

  // Selecting the zone that is already selected clears the selection.
  const handleSelectZone = (slug: string | null) => {
    setSelectedSlug((previous) => (previous === slug ? null : slug));
  };

  const selectedZone = zones.find((zone) => zone.slug === selectedSlug) ?? null;
  const isAuthError = (zonesError ?? itemsError ?? '').toLowerCase().includes('auth');
  const totalItems = zones.reduce((sum, zone) => sum + zone.itemCount, 0);
  const hasMap = !zonesLoading && !zonesError && zones.length > 0;

  return (
    <main className="page-canvas min-h-screen">
      <div
        className={cn(
          'container mx-auto px-4 pt-10 sm:pt-12 lg:pt-14',
          selectedZone ? 'pb-64 lg:pb-16' : 'pb-12 lg:pb-16'
        )}
      >
        <PageHeader
          title="Campus Map"
          description="Reports by campus zone. Select a zone to see what was reported there."
        />

        {/* The map is the hero: full-width, tall, with its own legend inside it.
            The selected-zone panel is a sibling rail on desktop and a bottom
            sheet on mobile, never a card pushed below the map. */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <section
            aria-label="Campus zones map"
            className="rise-in relative aspect-[16/10] min-h-[420px] w-full overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card"
          >
            {zonesLoading ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : zonesError ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="max-w-sm text-base text-muted-foreground">{zonesError}</p>
                {isAuthError ? (
                  <Button asChild>
                    <Link href="/auth/login">Sign in</Link>
                  </Button>
                ) : (
                  <Button onClick={fetchZones} variant="outline">
                    Try again
                  </Button>
                )}
              </div>
            ) : (
              <CampusMap
                zones={zones}
                selectedSlug={selectedSlug}
                onSelectZone={handleSelectZone}
                className="h-full"
              />
            )}

            {/* Campus-wide totals, in the corner the legend does not use. */}
            {hasMap && (
              <p className="absolute right-3 top-3 z-10 rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-card backdrop-blur-sm">
                {zones.length} {zones.length === 1 ? 'zone' : 'zones'}
                <span aria-hidden="true"> · </span>
                {totalItems} {totalItems === 1 ? 'report' : 'reports'}
              </p>
            )}
          </section>

          {/* Selected zone: right rail on desktop, bottom sheet on mobile. */}
          <aside
            key={selectedZone?.slug ?? 'none'}
            aria-label="Selected zone"
            className={cn(
              'rise-in z-40 bg-card/95 shadow-card backdrop-blur-sm',
              'fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border-subtle px-5 pb-6 pt-3',
              'lg:static lg:max-h-none lg:overflow-visible lg:rounded-xl lg:border lg:border-border-subtle lg:p-6 lg:backdrop-blur-none',
              !selectedZone && 'hidden lg:block'
            )}
          >
            <span
              className="mx-auto mb-3 block h-1 w-10 rounded-full bg-border lg:hidden"
              aria-hidden="true"
            />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {selectedZone ? selectedZone.name : 'Zones'}
                </h2>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                  {selectedZone
                    ? selectedZone.description || 'No description for this zone.'
                    : zones.length > 0
                      ? 'Pick a zone here or on the map.'
                      : 'Campus zones appear here once they are configured.'}
                </p>
              </div>

              {selectedZone && (
                <Button
                  variant="quiet"
                  size="icon-sm"
                  onClick={() => setSelectedSlug(null)}
                  aria-label="Close zone details"
                  className="shrink-0 lg:hidden"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>

            {/*
              With nothing selected the rail used to hold a two-line empty state
              and about 600px of nothing, in a bordered card — the single largest
              piece of dead space in the product. It is now an index of every
              zone with its counts, which also gives the map a keyboard- and
              screen-reader-friendly route to the same selection the pins offer.
            */}
            {!selectedZone && zones.length > 0 && (
              <ul className="mt-5 -mx-2 divide-y divide-border-subtle">
                {zones.map((zone) => (
                  <li key={zone.slug}>
                    <button
                      type="button"
                      onClick={() => handleSelectZone(zone.slug)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1 truncate text-base text-foreground">
                        {zone.name}
                      </span>
                      {zone.lostCount > 0 && (
                        <span className="shrink-0 text-xs tabular-nums text-warning">
                          {zone.lostCount} lost
                        </span>
                      )}
                      {zone.foundCount > 0 && (
                        <span className="shrink-0 text-xs tabular-nums text-success">
                          {zone.foundCount} found
                        </span>
                      )}
                      {/* Fixed width so the totals form a column instead of
                          running into the lost/found counts as one string. */}
                      <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                        {zone.itemCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selectedZone ? (
              <>
                <dl className="mt-5 grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Total</dt>
                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                      {selectedZone.itemCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Lost</dt>
                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-destructive">
                      {selectedZone.lostCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Found</dt>
                    <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-success">
                      {selectedZone.foundCount}
                    </dd>
                  </div>
                </dl>

                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => setSelectedSlug(null)}
                  className="mt-5 hidden px-0 lg:inline-flex"
                >
                  Clear selection
                </Button>
              </>
            ) : null}
          </aside>
        </div>

        {/* Items in the selected zone */}
        {selectedZone && (
          <section className="rise-in mt-12" aria-label={`Items reported in ${selectedZone.name}`}>
            <SectionHeader
              title={`Items reported in ${selectedZone.name}`}
              action={
                !itemsLoading && !itemsError && items.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Showing {items.length} of {itemsTotal} {itemsTotal === 1 ? 'item' : 'items'}
                  </p>
                ) : undefined
              }
            />

            <div className="mt-6">
              {itemsLoading ? (
                <SkeletonCardGrid count={6} className="lg:grid-cols-3 xl:grid-cols-4" />
              ) : itemsError ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                  <p className="text-base text-destructive">{itemsError}</p>
                  <Button
                    variant="outline"
                    onClick={() => setItemsReloadToken((token) => token + 1)}
                  >
                    Try again
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.items}
                  title="No items in this zone"
                  description={`Nothing has been reported in ${selectedZone.name} yet. Pick another zone on the map.`}
                  action={{ label: 'Clear selection', onClick: () => setSelectedSlug(null) }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={{
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        itemType: item.itemType,
                        status: item.status,
                        location: item.location,
                        createdAt: item.createdAt,
                        images: item.images,
                        category: item.category,
                        zone: item.zone,
                        postedBy: {
                          name: item.postedBy?.name ?? null,
                          avatar: item.postedBy?.avatar ?? null
                        }
                      }}
                      user={user}
                      showActions={true}
                      variant="compact"
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
