'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import CategoryFilter from '@/components/CategoryFilter';
import ClaimsModal from '@/components/ClaimsModal';
import ItemListShell, {
  type ListItem,
  type ListSelectConfig,
  type ListTextConfig,
} from '@/components/ItemListShell';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/lib/auth-fetch';
import { toast } from 'react-hot-toast';

/**
 * A lost report, as `GET /api/items?status=LOST` returns it — including the
 * `category` and `zone` relations, which the card needs for its icon and its
 * place name.
 */
type LostItem = ListItem;

interface LostFilters {
  itemType: string;
  location: string;
  category: string;
}

const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'LOST', label: 'Lost items' },
  { value: 'FOUND', label: 'Found items' },
] as const;

/**
 * Lost items — every open report, filtered by type, location and category.
 *
 * The frame (header, filter bar, grid, empty and loading states, pagination)
 * lives in ItemListShell; this file owns the query. Filters are part of the
 * request, live rather than deferred, and the page count comes from the
 * `pagination` envelope the API actually returns.
 */
export default function LostItemsPage() {
  const { fetchWithAuth } = useAuthFetch(false);
  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [user, setUser] = useState<{ isLoggedIn: boolean; userId?: string }>({
    isLoggedIn: false,
  });

  // Claims modal state
  const [claimsModalOpen, setClaimsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostItem | null>(null);

  const [filters, setFilters] = useState<LostFilters>({
    itemType: '',
    location: '',
    category: '',
  });

  const limit = 12;

  const fetchLostItems = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);

        // Every filter the user can see in the bar is sent to the API. They
        // were once bound to inputs and then dropped from the query, which made
        // the whole filter row decorative.
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          status: 'LOST',
          ...(filters.itemType && { itemType: filters.itemType }),
          ...(filters.location && { location: filters.location }),
          ...(filters.category && { category: filters.category }),
        });

        const response = await fetch(`/api/items?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setItems(data.items || []);
        // The envelope is `pagination`, and it is the only source of truth for
        // the count. A previous version read a top-level `data.total`, got
        // undefined -> NaN, and left the page controls dead.
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotal(data.pagination?.total ?? 0);

        setUser(data.user || { isLoggedIn: false });
      } catch {
        setError('Failed to load lost items. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [filters, limit]
  );

  const handleFilterChange = (key: keyof LostFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ itemType: '', location: '', category: '' });
    setCurrentPage(1);
  };

  const handleFoundClick = async (item: LostItem) => {
    if (!user.isLoggedIn) {
      toast.error('Please login to claim items');
      window.location.href = '/auth/login';
      return;
    }

    const isOwner = user.userId === item.postedBy.id;

    if (isOwner) {
      const confirmed = window.confirm(
        `Did you find your "${item.title}"?\n\nThis will mark the item as RESOLVED.`
      );

      if (confirmed) {
        try {
          const response = await fetchWithAuth(`/api/items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'RESOLVED' }),
          });

          if (!response.ok) {
            throw new Error('Failed to update item status');
          }

          toast.success('Item marked as resolved!');
          fetchLostItems(currentPage);
        } catch {
          toast.error('Failed to update item status. Please try again.');
        }
      }
    } else {
      setSelectedItem(item);
      setClaimsModalOpen(true);
    }
  };

  const handleClaimSuccess = () => {
    setClaimsModalOpen(false);
    setSelectedItem(null);
    toast.success('Claim submitted successfully! The owner will review it.');
    fetchLostItems(currentPage);
  };

  useEffect(() => {
    fetchLostItems(currentPage);
  }, [currentPage, fetchLostItems]);

  const selects: ListSelectConfig[] = [
    {
      id: 'filter-item-type',
      label: 'Item type',
      value: filters.itemType,
      options: ITEM_TYPE_OPTIONS,
      onChange: (value) => handleFilterChange('itemType', value),
      className: 'sm:w-40',
    },
  ];

  const texts: ListTextConfig[] = [
    {
      id: 'filter-location',
      label: 'Location',
      value: filters.location,
      placeholder: 'Filter by location…',
      onChange: (value) => handleFilterChange('location', value),
      className: 'sm:w-56',
    },
  ];

  const activeFilterCount =
    (filters.itemType ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.category ? 1 : 0);

  return (
    <>
      <ItemListShell
        title="Lost items"
        description="Everything reported missing on campus, newest first."
        // The title already says "Lost items"; repeating it here read as
        // "Lost items 11 lost items". The meta only has to give the number.
        noun={{ singular: 'report', plural: 'reports' }}
        actions={
          <Button asChild>
            <Link href="/post">Report a lost item</Link>
          </Button>
        }
        items={items}
        total={total}
        loading={loading}
        error={error}
        onRetry={() => fetchLostItems(currentPage)}
        texts={texts}
        selects={selects}
        facets={
          <CategoryFilter
            value={filters.category || null}
            onChange={(slug) => handleFilterChange('category', slug ?? '')}
          />
        }
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        cardProps={{
          user,
          showActions: true,
          onFound: (item) => {
            void handleFoundClick(item);
          },
        }}
        emptyCopy={{
          nothing: {
            title: 'No lost items reported yet',
            description:
              'Nothing has been reported missing yet. If you have lost something, post it and the people who find things can match it.',
            action: { label: 'Report a lost item', href: '/post' },
          },
          noResults: {
            title: 'No lost items match these filters',
            description:
              'Try a broader location, or clear the filters to see every open report.',
          },
        }}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {selectedItem && (
        <ClaimsModal
          isOpen={claimsModalOpen}
          onClose={() => {
            setClaimsModalOpen(false);
            setSelectedItem(null);
          }}
          itemId={selectedItem.id}
          itemTitle={selectedItem.title}
          isOwner={user.userId === selectedItem.postedBy.id}
          onSuccess={handleClaimSuccess}
        />
      )}
    </>
  );
}
