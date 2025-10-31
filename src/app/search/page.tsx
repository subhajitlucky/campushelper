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
    avatar: string | null;
    // email intentionally excluded for public access
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
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [user, setUser] = useState<{isLoggedIn: boolean; userId?: string}>({ isLoggedIn: false });
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
  const limit = 20; // Items per page

  // Fetch items from API
  const fetchItems = useCallback(async (page?: number) => {
    try {
      setLoading(true);
      setSearchError(null);
      setHasSearched(true); // Mark that user has performed a search
      
      const queryParams = new URLSearchParams({
        page: (page || currentPage).toString(),
        limit: limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.itemType && { itemType: filters.itemType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.location && { location: filters.location }),
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
      });

      const response = await fetch(`/api/items?${queryParams.toString()}`);
      
      if (!response.ok) {
        // Handle HTTP errors gracefully without throwing
        let errorMessage = 'Failed to search items. Please try again.';
        
        if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (response.status >= 400) {
          errorMessage = 'Search request failed. Please check your input.';
        }
        
        setSearchError(errorMessage);
        setItems([]);
        return; // Exit early, don't continue processing
      }

      const data = await response.json();
      
      // Update state with API response
      setItems(data.items || []);
      setCurrentPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
      
      // Store user authentication status
      setUser(data.user || { isLoggedIn: false });
      
    } catch (error) {
      console.error('Network error:', error);
      setItems([]);
      setSearchError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, limit]); // Include all dependencies

  // Fetch items on component mount and when filters change
  // REMOVED: Auto-fetch logic to prevent 401 errors
  // useEffect(() => {
  //   fetchItems(currentPage); // Pass current page
  // }, [fetchItems, currentPage]); // Re-fetch when fetchItems changes or page changes

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
              <div className="flex gap-2">
                <input
                  type="text"
                  id="search"
                  placeholder="Search by title, description, or location..."
                  value={filters.search}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && fetchItems()}
                />
                <button
                  onClick={() => fetchItems()}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
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
              {hasSearched ? `Search Results (${total})` : 'Search Items'}
            </h2>
          </div>
          
          <div className="p-6">
            {searchError ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium mb-2">{searchError}</p>
                <p className="text-gray-500 text-sm">
                  {searchError.includes('login') ? (
                    <>
                      Please{' '}
                      <a href="/auth/login" className="text-blue-600 hover:text-blue-500 underline">
                        log in
                      </a>{' '}
                      to search for items, or try{' '}
                      <a href="/resolved" className="text-blue-600 hover:text-blue-500 underline">
                        browsing resolved items
                      </a>.
                    </>
                  ) : (
                    'Please try searching again or adjust your filters.'
                  )}
                </p>
              </div>
            ) : !hasSearched ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Search?</h3>
                <p className="text-gray-500 mb-4">
                  Enter what you're looking for above and click search to find lost and found items on campus.
                </p>
                <div className="text-sm text-gray-400">
                  <p>💡 You can search for items by:</p>
                  <ul className="mt-2 space-y-1">
                    <li>• Item name (e.g., "laptop", "phone", "keys")</li>
                    <li>• Description (e.g., "black backpack", "silver watch")</li>
                    <li>• Location (e.g., "library", "cafeteria")</li>
                  </ul>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.34 0-4.5-.785-6.172-2.172M12 3c3.314 0 6 2.686 6 6 0 1.86-.792 3.542-2.073 4.828" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
                <p className="text-gray-500 mb-4">
                  {filters.search 
                    ? `No items found for "${filters.search}". Try different keywords or check your filters.`
                    : 'No items match your current filters. Try adjusting your search criteria.'
                  }
                </p>
                <button 
                  onClick={() => updateFilters({ search: '', itemType: '', status: '', location: '', from: '', to: '' })}
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                >
                  Clear all filters
                </button>
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
                              Post Your Item
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
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
                  {currentPage < totalPages - 2 && totalPages > 5 && (
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
      </div>
    </div>
  );
}
