'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import ItemImage from "@/components/ui/ItemImage";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState, { EmptyStateIcons } from "@/components/ui/EmptyState";
import { ItemListSkeleton } from "@/components/ui/LoadingSkeleton";
import UserDisplay from "@/components/ui/UserDisplay";
import ItemCard from "@/components/ui/ItemCard";
import Pagination from "@/components/ui/Pagination";
import ClaimsModal from "@/components/ClaimsModal";
import { useAuthFetch } from "@/lib/auth-fetch";
import { toast } from "react-hot-toast";

interface LostItem {
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
    // Note: email intentionally excluded for public access (privacy)
  };
}

interface LostFilters {
  itemType: string;
  location: string;
}

export default function LostItemsPage() {
  const { fetchWithAuth } = useAuthFetch(false);
  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [user, setUser] = useState<{isLoggedIn: boolean; userId?: string}>({ isLoggedIn: false });

  // Claims Modal State
  const [claimsModalOpen, setClaimsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostItem | null>(null);

  const [filters, setFilters] = useState<LostFilters>({
    itemType: '',
    location: '',
  });

  const limit = 12;

  const fetchLostItems = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: 'LOST',
      });

      const response = await fetch(`/api/items?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setItems(data.items || []);
      setTotalPages(Math.ceil(data.total / limit));
      setTotal(data.total); // Set total items
      
      // Store user authentication status
      setUser(data.user || { isLoggedIn: false });
    } catch (err) {
      setError('Failed to load lost items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Handle filter changes
  const handleFilterChange = (key: keyof LostFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Apply filters
  const applyFilters = () => {
    fetchLostItems(1);
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      itemType: '',
      location: '',
    });
    setCurrentPage(1);
  };

  // Handle "I Found This" button click
  const handleFoundClick = async (item: LostItem) => {
    if (!user.isLoggedIn) {
      toast.error('Please login to claim items');
      window.location.href = '/auth/login';
      return;
    }

    const isOwner = user.userId === item.postedBy.id;

    if (isOwner) {
      // Owner found their own item - show confirmation dialog
      const confirmed = window.confirm(
        `Did you find your "${item.title}"?\n\nThis will mark the item as RESOLVED.`
      );

      if (confirmed) {
        try {
          const response = await fetchWithAuth(`/api/items/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'RESOLVED',
              claimedById: user.userId, // Set owner as the person who resolved it
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to update item status');
          }

          toast.success('Item marked as resolved!');
          // Refresh the items list
          fetchLostItems(currentPage);
        } catch (err) {
          toast.error('Failed to update item status. Please try again.');
        }
      }
    } else {
      // Non-owner wants to claim - open claims modal
      setSelectedItem(item);
      setClaimsModalOpen(true);
    }
  };

  const handleClaimSuccess = () => {
    setClaimsModalOpen(false);
    setSelectedItem(null);
    toast.success('Claim submitted successfully! The owner will review it.');
    // Optionally refresh items
    fetchLostItems(currentPage);
  };

  // Fetch items when page or filters change
  useEffect(() => {
    fetchLostItems(currentPage);
  }, [currentPage, fetchLostItems]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Filter Stories */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Lost Items</CardTitle>
            <CardDescription>Find specific lost items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Item Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Type
                </label>
                <select
                  value={filters.itemType}
                  onChange={(e) => handleFilterChange('itemType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="LOST">Lost Items</option>
                  <option value="FOUND">Found Items</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  placeholder="Filter by location..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 items-end">
                <Button onClick={applyFilters} className="flex-1">
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={clearFilters}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && <ItemListSkeleton count={6} />}

        {/* Error State */}
        {error && !loading && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={() => fetchLostItems(currentPage)}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            {/* Results Header */}
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                {items.length > 0 ? (
                  <>
                    Found <span className="font-semibold">{items.length}</span> lost items
                    {currentPage > 1 && (
                      <span> (page {currentPage} of {totalPages})</span>
                    )}
                  </>
                ) : (
                  'No lost items found'
                )}
              </p>
              {items.length > 0 && (
                <p className="text-sm text-gray-500">
                  Total: {total} items
                </p>
              )}
            </div>

            {/* Items Grid */}
            {items.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <EmptyState
                    icon={EmptyStateIcons.items}
                    title="No Lost Items Found"
                    description="No items match your current filters. Try adjusting your search criteria."
                    action={{
                      label: "Clear Filters",
                      onClick: clearFilters
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                        name: item.postedBy.name,
                        avatar: item.postedBy.avatar
                      }
                    }}
                    user={user}
                    showActions={true}
                    variant="compact"
                    onFound={() => handleFoundClick(item)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                total={total}
                className="mt-8"
              />
            )}
          </>
        )}
      </div>

      {/* Claims Modal */}
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
    </div>
  );
}
