'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";

interface LostItem {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
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
  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [user, setUser] = useState<{isLoggedIn: boolean; userId?: string}>({ isLoggedIn: false });

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
      console.error('Error fetching lost items:', err);
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

  // Fetch items when page or filters change
  useEffect(() => {
    fetchLostItems(currentPage);
  }, [currentPage, fetchLostItems]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Lost Items</h1>
          <p className="text-gray-600 text-lg">Find items that have been reported as lost on campus</p>
        </div>
        
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
        {loading && <ListSkeleton count={6} />}

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
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.34 0-4.5-.785-6.172-2.172M12 3c3.314 0 6 2.686 6 6 0 1.86-.792 3.542-2.073 4.828" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Lost Items Found</h3>
                    <p className="text-gray-500 mb-4">
                      No items match your current filters. Try adjusting your search criteria.
                    </p>
                    <Button onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'LOST': return 'bg-red-100 text-red-800 border-red-200';
                      case 'FOUND': return 'bg-green-100 text-green-800 border-green-200';
                      case 'CLAIMED': return 'bg-blue-100 text-blue-800 border-blue-200';
                      case 'RESOLVED': return 'bg-purple-100 text-purple-800 border-purple-200';
                      default: return 'bg-gray-100 text-gray-800 border-gray-200';
                    }
                  };

                  const formatDate = (dateString: string) => {
                    return new Date(dateString).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  };

                  return (
                    <div key={item.id} className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                      {/* Card Header */}
                      <div className="p-4 border-b bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{item.title}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(item.status)} ml-2 flex-shrink-0`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{formatDate(item.createdAt)}</p>
                      </div>

                      {/* Card Body */}
                      <div className="p-4">
                        <p className="text-gray-600 mb-4 line-clamp-3 text-sm">{item.description}</p>
                        
                        {/* Item Details */}
                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.34 0-4.5-.785-6.172-2.172M12 3c3.314 0 6 2.686 6 6 0 1.86-.792 3.542-2.073 4.828" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {item.location}
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-500">
                            {item.postedBy.avatar ? (
                              <Image
                                src={item.postedBy.avatar}
                                alt={item.postedBy.name || 'User avatar'}
                                width={20}
                                height={20}
                                className="rounded-full object-cover mr-2"
                              />
                            ) : (
                              <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                                <span className="text-xs text-gray-500">
                                  {(item.postedBy.name || 'A').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span>Reported by {item.postedBy.name || 'Anonymous'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="p-4 bg-gray-50 border-t">
                        {user.isLoggedIn ? (
                          // Logged-in user actions
                          <div className="space-y-2">
                            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Details
                            </button>
                            {item.status === 'LOST' && (
                              <button className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                I Found This!
                              </button>
                            )}
                          </div>
                        ) : (
                          // Guest user actions
                          <div className="space-y-2">
                            <button 
                              onClick={() => window.location.href = '/auth/login'}
                              className="w-full bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Login to View Details
                            </button>
                            <button 
                              onClick={() => window.location.href = '/auth/login'}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                              </svg>
                              Report Found Item
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-lg shadow p-6 mt-8">
                <div className="flex items-center justify-between">
                  {/* Page Info */}
                  <div className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span> ({total} total items)
                  </div>

                  {/* Pagination Buttons */}
                  <div className="flex items-center space-x-2">
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center space-x-1">
                      {/* First page */}
                      {currentPage > 3 && (
                        <>
                          <button
                            onClick={() => setCurrentPage(1)}
                            className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            1
                          </button>
                          {currentPage > 4 && <span className="text-gray-400">...</span>}
                        </>
                      )}

                      {/* Current page and neighbors */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
                        if (pageNum > totalPages - 3 && totalPages > 5) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md border ${
                              pageNum === currentPage
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      {/* Last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && <span className="text-gray-400">...</span>}
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Next
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
