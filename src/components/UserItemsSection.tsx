'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Eye, Pencil, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import EmptyState, { EmptyStateIcons } from '@/components/ui/EmptyState';
import ItemCard from '@/components/ui/ItemCard';
import SectionHeader from '@/components/ui/SectionHeader';
import { SkeletonCardGrid } from '@/components/ui/SkeletonCard';
import { useAuthFetch } from '@/lib/auth-fetch';

/**
 * Shape returned by `GET /api/items?postedById=…`, narrowed to what the card
 * needs. `ItemCard`'s own `Item` type is not exported, so this mirrors it
 * structurally rather than duplicating the component.
 */
interface UserItem {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
  images?: string[] | null;
  tags?: string[] | null;
  category?: { slug: string; name: string; icon: string } | null;
  zone?: { slug: string; name: string } | null;
  postedBy: { name: string | null; avatar: string | null; reputation?: number | null };
}

interface UserItemsSectionProps {
  userId: string;
}

/**
 * The "My items" tab panel.
 *
 * Everything that used to be a bordered row (`border rounded-lg p-4`, twice
 * nested inside a `Card`, once per item) is now an `ItemCard` — the one card in
 * this section, and only for a discrete object. Ownership actions sit *under*
 * the card as quiet text buttons instead of inside it, so the card keeps a
 * single link target and the rows cannot disagree about geometry.
 *
 * The section header is `divider={false}` because the dashboard's tab rule
 * already closes the space above it.
 */
export default function UserItemsSection({ userId }: UserItemsSectionProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch items posted by this user
      const response = await fetch(`/api/items?postedById=${userId}&limit=50`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch your items');
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch {
      setError('Failed to load your items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Handle delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently remove the item from public view. Continue?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Remove item from local state
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch {
      setError('Failed to delete item. Please try again.');
    }
  };

  // Handle edit item - navigate to item detail page with edit mode
  const handleEditItem = (itemId: string) => {
    // Navigate to item detail page where inline editing is available
    window.location.href = `/item/${itemId}?edit=true`;
  };

  useEffect(() => {
    if (userId) {
      fetchUserItems();
    }
  }, [userId, fetchUserItems]);

  const header = (description: string, showSearch: boolean) => (
    <SectionHeader
      title="Your items"
      description={description}
      divider={false}
      action={
        showSearch ? (
          <Button variant="quiet" size="sm" asChild>
            <Link href="/search">
              <Search className="mr-1.5 size-4" aria-hidden="true" />
              Search all items
            </Link>
          </Button>
        ) : undefined
      }
    />
  );

  // Loading state
  if (loading) {
    return (
      <section aria-label="Your items">
        {header('Reports you have posted.', false)}
        <SkeletonCardGrid count={3} className="mt-6 gap-6" />
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section aria-label="Your items">
        {header('Reports you have posted.', false)}
        <EmptyState
          icon={EmptyStateIcons.default}
          title="Your items could not be loaded"
          description={error}
          action={{ label: 'Try again', onClick: fetchUserItems }}
        />
      </section>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <section aria-label="Your items">
        {header('Reports you have posted.', false)}
        <EmptyState
          icon={EmptyStateIcons.items}
          title="No items posted yet"
          description="Report something you have lost or found and it will show up here."
          action={{
            label: 'Post your first item',
            onClick: () => {
              window.location.href = '/post';
            },
          }}
        />
      </section>
    );
  }

  return (
    <section aria-label="Your items">
      {header(
        `${items.length} report${items.length === 1 ? '' : 's'} posted. Edit or remove them here.`,
        true
      )}

      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const canManage = item.status !== 'DELETED' && item.status !== 'RESOLVED';

          return (
            <li key={item.id} className="flex">
              <div className="flex w-full flex-col">
                <ItemCard item={item} showActions={false} className="flex-1" />

                <div className="mt-3 flex items-center gap-1">
                  <Button variant="quiet" size="sm" asChild>
                    <Link href={`/item/${item.id}`}>
                      <Eye className="mr-1.5 size-4" aria-hidden="true" />
                      View
                    </Link>
                  </Button>

                  {canManage && (
                    <>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => handleEditItem(item.id)}
                      >
                        <Pencil className="mr-1.5 size-4" aria-hidden="true" />
                        Edit
                      </Button>

                      <Button
                        variant="quiet"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </>
                  )}

                  <span className="ml-auto text-xs font-medium text-muted-foreground">
                    {item.itemType === 'LOST' ? 'Lost report' : 'Found report'}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
