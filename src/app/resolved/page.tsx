'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ResolvedItem {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
  resolvedAt: string | null;
  postedBy: {
    id: string;
    name: string | null;
    avatar: string | null;
    // Note: email intentionally excluded for public resolved items (privacy)
  };
}

interface ResolvedFilters {
  itemType: string;
  location: string;
}

export default function ResolvedPage() {
  // Fix hydration error by using consistent initial state
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Ensure consistent initial state for filters (critical for hydration)
  const [filters, setFilters] = useState<ResolvedFilters>(() => ({
    itemType: '', // Always start with empty string
    location: '', // Always start with empty string
  }));

  const limit = 12;

  const fetchResolvedItems = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: 'RESOLVED',
      });

      const response = await fetch(`/api/items?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setItems(data.items || []);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err) {
      setError('Failed to load resolved items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Fetch items when page or filters change
  useEffect(() => {
    fetchResolvedItems(currentPage);
  }, [currentPage, fetchResolvedItems]);

  // Handle filter changes
  const handleFilterChange = (key: keyof ResolvedFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Apply filters
  const applyFilters = () => {
    fetchResolvedItems(1);
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

  // Pagination helpers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
            Success Stories
          </h1>
          <p className="text-gray-600 text-lg">
            See how Campus Helper has reunited people with their lost belongings
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Stories</CardTitle>
            <CardDescription>Find specific success stories</CardDescription>
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
        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={() => fetchResolvedItems(currentPage)}>
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
                    Showing <span className="font-semibold">{items.length}</span> success stories
                    {currentPage > 1 && (
                      <span> (page {currentPage} of {totalPages})</span>
                    )}
                  </>
                ) : (
                  'No success stories found'
                )}
              </p>
              <Link href="/search">
                <Button variant="outline" size="sm">
                  Browse Active Listings
                </Button>
              </Link>
            </div>

            {/* Items Grid */}
            {items.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {items.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
                          {item.title}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge variant={item.itemType === 'LOST' ? 'destructive' : 'default'} className="text-xs">
                            {item.itemType}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                            ✅ Successfully Resolved
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-xs text-gray-500">
                        Location: {item.location} • {new Date(item.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {item.description}
                      </p>
                      {item.resolvedAt && (
                        <div className="text-xs text-green-600 font-medium">
                          Resolved on {new Date(item.resolvedAt).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {item.postedBy.avatar ? (
                          <Image
                            src={item.postedBy.avatar}
                            alt={item.postedBy.name || 'User avatar'}
                            width={20}
                            height={20}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-xs text-gray-500">
                              {(item.postedBy.name || 'A').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span>Posted by {item.postedBy.name || 'Anonymous'}</span>
                      </div>
                      <Button asChild size="sm" className="w-full mt-auto">
                        <Link href={`/item/${item.id}`}>View Full Story</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="mb-8">
                <CardContent className="pt-6 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No success stories found
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Try adjusting your filters or check back later for new success stories.
                  </p>
                  <Button onClick={clearFilters} className="mb-4">
                    Clear Filters
                  </Button>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">
                      Want to help create more success stories?
                    </p>
                    <Link href="/post">
                      <Button variant="outline">
                        Report a Lost/Found Item
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </Button>

                {getPageNumbers().map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
