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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search Items</h1>
        <p className="text-gray-600 mb-8">Search and browse lost and found items on campus.</p>
        
        {/* Search and filters will go here */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <p className="text-gray-500">Search functionality coming soon...</p>
        </div>

        {/* Items display will go here */}
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Items display coming soon...</p>
        </div>
      </div>
    </div>
  );
}
