'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import CampusMap, { type CampusMapZone } from '@/components/CampusMap';
import ItemCard from '@/components/ui/ItemCard';
import EmptyState, { EmptyStateIcons } from '@/components/ui/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ItemListSkeleton } from '@/components/ui/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
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
 * Campus map page: zones on a schematic map, items for the selected zone below.
 *
 * Both endpoints require authentication, so `useAuthFetch(true)` guards the
 * page and reports an authentication error rather than an empty map.
 */
export default function MapPage() {
  const { fetchWithAuth } = useAuthFetch(true);

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Campus Map</h1>
          <p className="text-gray-600">
            Browse lost and found reports by campus zone. Select a zone to see what was reported there.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Map */}
          <Card hover={false} className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Zones</CardTitle>
              <CardDescription>Pin size shows how many items were reported in a zone</CardDescription>
            </CardHeader>
            <CardContent>
              {zonesLoading ? (
                <Skeleton className="aspect-square w-full" />
              ) : zonesError ? (
                <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-gray-600">{zonesError}</p>
                  {isAuthError ? (
                    <Button asChild>
                      <Link href="/auth/login">Sign In</Link>
                    </Button>
                  ) : (
                    <Button onClick={fetchZones} variant="outline">
                      Try Again
                    </Button>
                  )}
                </div>
              ) : (
                <CampusMap
                  zones={zones}
                  selectedSlug={selectedSlug}
                  onSelectZone={handleSelectZone}
                />
              )}
            </CardContent>
          </Card>

          {/* Selected zone stats */}
          <Card hover={false} className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedZone ? selectedZone.name : 'Zone details'}
              </CardTitle>
              <CardDescription>
                {selectedZone
                  ? selectedZone.description || 'No description for this zone'
                  : 'Select a zone on the map to see its statistics.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedZone ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{selectedZone.itemCount}</p>
                    <p className="text-sm text-gray-500">Total items</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-red-600">{selectedZone.lostCount}</p>
                    <p className="text-sm text-gray-500">Lost</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-green-600">{selectedZone.foundCount}</p>
                    <p className="text-sm text-gray-500">Found</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {zones.length > 0
                    ? 'No zone selected'
                    : 'Campus zones will appear here once they are configured.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items in the selected zone */}
        {selectedZone && (
          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Items reported in {selectedZone.name}
              </h2>
              {!itemsLoading && !itemsError && items.length > 0 && (
                <p className="text-sm text-gray-500">
                  Showing {items.length} of {itemsTotal} {itemsTotal === 1 ? 'item' : 'items'}
                </p>
              )}
            </div>

            {itemsLoading ? (
              <ItemListSkeleton count={6} />
            ) : itemsError ? (
              <Card hover={false}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-red-600 mb-4">{itemsError}</p>
                    <Button
                      variant="outline"
                      onClick={() => setItemsReloadToken((token) => token + 1)}
                    >
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : items.length === 0 ? (
              <Card hover={false}>
                <CardContent className="pt-6">
                  <EmptyState
                    icon={EmptyStateIcons.items}
                    title="No items in this zone"
                    description={`Nothing has been reported in ${selectedZone.name} yet. Pick another zone on the map.`}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        )}
      </div>
    </div>
  );
}
