'use client';

import { useState } from 'react';

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
  const [query, setQuery] = useState('');
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
  const fetchItems = async (searchParams?: Partial<SearchFilters>, page: number = 1) => {
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
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search Items</h1>
        <p className="text-gray-600 mb-8">Search and browse lost and found items on campus.</p>
        
        {/* Search and filters will go here */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <p className="text-gray-500">Search functionality coming soon...</p>
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
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading items...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No items found. Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{item.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.itemType === 'LOST' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.itemType}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>📍 {item.location}</span>
                      <span>👤 {item.postedBy.name || item.postedBy.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
