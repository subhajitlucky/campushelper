/**
 * ItemDetail Component
 * Displays comprehensive item information in a professional layout
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import CommentsSection from './CommentsSection';
import ClaimsModal from './ClaimsModal';

interface ItemUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
  location: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  postedBy: ItemUser;
  claimedBy?: ItemUser | null;
  commentCount?: number;
  claimCount?: number;
}

interface ItemDetailProps {
  item: ItemData;
}

export default function ItemDetail({ item }: ItemDetailProps) {
  const { data: session } = useSession();
  const [isClaimsModalOpen, setIsClaimsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemStatus, setItemStatus] = useState(item.status);
  
  // Fix: Add proper error/success state management
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Step 112: Check permissions
  const isOwner = session?.user?.id === item.postedBy.id;
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';
  const canEdit = isOwner || isAdmin;
  const isLoggedIn = !!session?.user;

  // Step 112: Handle edit - redirect to post page with pre-filled data
  const handleEdit = () => {
    // Store item data in localStorage for the post form to pre-fill
    const editData = {
      id: item.id,
      title: item.title,
      description: item.description,
      itemType: item.itemType,
      location: item.location,
      images: item.images,
      isEdit: true
    };
    
    localStorage.setItem('editItem', JSON.stringify(editData));
    window.location.href = '/post';
  };

  // Step 112: Handle delete with confirmation
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently remove the item from public view. Continue?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Update local state to reflect deletion
      setItemStatus('DELETED');
      setSuccess('Item has been deleted successfully.');
      
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {item.title}
          </h1>
          <div className="flex items-center gap-4 mt-4">
            {/* Item Type Badge */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              item.itemType === 'LOST' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {item.itemType}
            </span>
            
            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              itemStatus === 'LOST' ? 'bg-red-100 text-red-800' :
              itemStatus === 'FOUND' ? 'bg-green-100 text-green-800' :
              itemStatus === 'CLAIMED' ? 'bg-blue-100 text-blue-800' :
              itemStatus === 'RESOLVED' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {itemStatus}
            </span>
            
            {/* Location */}
            <span className="text-gray-600">
              📍 {item.location}
            </span>
          </div>
        </div>

        {/* Show message if item is deleted */}
        {itemStatus === 'DELETED' && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-800 font-medium">
                This item has been deleted and is no longer available.
              </p>
            </div>
            {canEdit && (
              <p className="text-red-600 text-sm mt-1">
                Only admins/moderators can see deleted items.
              </p>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Item Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Description</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            </div>

            {/* Images Section */}
            {item.images && item.images.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Images</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {item.images.map((image: string, index: number) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={image}
                        alt={`${item.title} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 109: Comments Section - Hide if item is deleted */}
            {itemStatus !== 'DELETED' && (
              <CommentsSection itemId={item.id} />
            )}
          </div>

          {/* Right Column - User Info & Actions */}
          <div className="space-y-6">
            {/* Posted By */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Posted By</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  {item.postedBy?.avatar ? (
                    <img
                      src={item.postedBy.avatar}
                      alt={item.postedBy.name || 'User'}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <span className="text-gray-600 font-medium">
                      {(item.postedBy?.name || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {item.postedBy?.name || 'Anonymous'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {item.postedBy?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Claimed By (if item is claimed) */}
            {item.claimedBy && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Claimed By</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    {item.claimedBy.avatar ? (
                      <img
                        src={item.claimedBy.avatar}
                        alt={item.claimedBy.name || 'User'}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <span className="text-gray-600 font-medium">
                        {(item.claimedBy.name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.claimedBy.name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.claimedBy.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Item Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Comments</span>
                  <span className="font-medium">{item.commentCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Claims</span>
                  <span className="font-medium">{item.claimCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Posted</span>
                  <span className="font-medium">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 111 & 112: Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Actions</h3>
              
              {/* Fix: Add error/success message display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                {/* Step 112: Edit/Delete Buttons - Show if can edit */}
                {canEdit && itemStatus !== 'DELETED' && (
                  <>
                    <button
                      onClick={handleEdit}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Edit Item
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Item'}
                    </button>
                  </>
                )}
                
                {/* Step 111: Claim Button - Show if logged in and not owner */}
                {isLoggedIn && !isOwner && itemStatus !== 'DELETED' && (
                  <button
                    onClick={() => setIsClaimsModalOpen(true)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Claim Item
                  </button>
                )}
                
                {/* Show login prompt if not logged in */}
                {!isLoggedIn && itemStatus !== 'DELETED' && (
                  <a
                    href="/auth/login"
                    className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sign In to Claim
                  </a>
                )}
                
                {/* Show owner message */}
                {isLoggedIn && isOwner && itemStatus !== 'DELETED' && !canEdit && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      This is your item
                    </p>
                  </div>
                )}
                
                {/* TODO: Add share functionality */}
              </div>
            </div>
          </div>
        </div>

        {/* Step 111: Claims Modal */}
        <ClaimsModal
          isOpen={isClaimsModalOpen}
          onClose={() => setIsClaimsModalOpen(false)}
          itemId={item.id}
          itemTitle={item.title}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
