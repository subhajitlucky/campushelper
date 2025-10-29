'use client';

import { useState, useEffect, useCallback } from 'react';

interface Item {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
  postedBy: {
    name: string | null;
    email: string;
  };
}

interface SearchFilters {
  search: string;
  itemType: string;
  status: string;
  location: string;
  from: string;
  to: string;
}

export default function SearchPage() {
  // Main search state
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    search: '',
    itemType: '',
    status: '',
    location: '',
    from: '',
    to: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Fetch items from API
  const fetchItems = useCallback(async (searchParams?: Partial<SearchFilters>, page: number = 1) => {
    setLoading(true);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20'); // 20 items per page
      
      // Add filters if provided, otherwise use current filters
      const activeFilters = searchParams || filters;
      
      if (activeFilters.search) params.set('q', activeFilters.search);
      if (activeFilters.itemType) params.set('type', activeFilters.itemType);
      if (activeFilters.status) params.set('status', activeFilters.status);
      if (activeFilters.location) params.set('location', activeFilters.location);
      if (activeFilters.from) params.set('from', activeFilters.from);
      if (activeFilters.to) params.set('to', activeFilters.to);

      // Fetch from API
      const response = await fetch(`/api/items?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }

      const data = await response.json();
      
      // Update state
      setItems(data.items || []);
      setCurrentPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
      
    } catch (error) {
      console.error('Error fetching items:', error);
      // Handle error - could set an error state here
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]); // Only depend on filters, page is passed as parameter

  // Fetch items on component mount and when filters change
  useEffect(() => {
    fetchItems(undefined, currentPage); // Pass current page
  }, [fetchItems, currentPage]); // Re-fetch when fetchItems changes or page changes

  // Function to update filters and reset page
  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search Items</h1>
        <p className="text-gray-600 mb-8">Search and browse lost and found items on campus.</p>
        
        {/* Search and filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="space-y-4">
            {/* Search Input */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Items
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search by title, description, or location..."
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Advanced Filter Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Item Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Type
                </label>
                <select
                  value={filters.itemType}
                  onChange={(e) => updateFilters({ itemType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="LOST">Lost Items</option>
                  <option value="FOUND">Found Items</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilters({ status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="LOST">Lost</option>
                  <option value="FOUND">Found</option>
                  <option value="CLAIMED">Claimed</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <select
                  value={filters.location}
                  onChange={(e) => updateFilters({ location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Locations</option>
                  <option value="Library">Library</option>
                  <option value="Engineering Building">Engineering Building</option>
                  <option value="Cafeteria">Cafeteria</option>
                  <option value="Student Center">Student Center</option>
                  <option value="Gym">Gym</option>
                  <option value="Main Hall">Main Hall</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Quick Filters:</span>
              <button
                onClick={() => updateFilters({ itemType: 'LOST' })}
                className={`px-3 py-1 rounded-full text-sm border ${
                  filters.itemType === 'LOST'
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
              >
                Lost Items
              </button>
              <button
                onClick={() => updateFilters({ itemType: 'FOUND' })}
                className={`px-3 py-1 rounded-full text-sm border ${
                  filters.itemType === 'FOUND'
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
              >
                Found Items
              </button>
              <button
                onClick={() => updateFilters({ itemType: '', status: '' })}
                className="px-3 py-1 rounded-full text-sm border bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Items display */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Items ({total})
            </h2>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    {/* Card Header Skeleton */}
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="h-5 bg-gray-200 rounded animate-pulse flex-1 mr-2"></div>
                        <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                    </div>

                    {/* Card Body Skeleton */}
                    <div className="p-4">
                      <div className="space-y-2 mb-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse mr-2"></div>
                          <div className="h-4 bg-gray-200 rounded animate-pulse flex-1"></div>
                        </div>
                        <div className="flex items-center">
                          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse mr-2"></div>
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Skeleton */}
                    <div className="p-4 bg-gray-50 border-t">
                      <div className="h-9 bg-gray-200 rounded animate-pulse w-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No items found. Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {item.location}
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Posted by {item.postedBy.name || 'Anonymous'}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="p-4 bg-gray-50 border-t">
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
