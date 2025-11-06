/**
 * ItemDetail Component
 * Displays comprehensive item information in a professional layout
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CommentsSection from './CommentsSection';
import ClaimsModal from './ClaimsModal';
import { useAuthFetch } from '@/lib/auth-fetch';

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
  views?: number;
}

interface ItemDetailProps {
  item: ItemData;
}

export default function ItemDetail({ item }: ItemDetailProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { fetchWithAuth } = useAuthFetch(true);
  const [isClaimsModalOpen, setIsClaimsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemStatus, setItemStatus] = useState(item.status);
  
  // Fix: Add proper error/success state management
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: item.title,
    description: item.description,
    location: item.location,
    itemType: item.itemType
  });
  const [isSaving, setIsSaving] = useState(false);

  // Step 112: Check permissions
  const isOwner = session?.user?.id === item.postedBy.id;
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';
  const canEdit = (isOwner || isAdmin) && itemStatus !== 'RESOLVED'; // Can't edit resolved items
  const isLoggedIn = !!session?.user;
  const isResolved = itemStatus === 'RESOLVED'; // Check if item is resolved

  // Check URL parameter to auto-enter edit mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('edit') === 'true' && canEdit) {
        setIsEditMode(true);
        // Remove the edit parameter from URL for cleaner UI
        window.history.replaceState({}, '', `/item/${item.id}`);
      }
    }
  }, [canEdit, item.id]);

  // Step 112: Handle edit - redirect to post page with pre-filled data
  const handleEdit = () => {
    setIsEditMode(true);
    setError(null);
    setSuccess(null);
  };
  
  // Handle save edit
  const handleSaveEdit = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetchWithAuth(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update item');
      }

      setSuccess('Item updated successfully!');
      setIsEditMode(false);
      
      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditForm({
      title: item.title,
      description: item.description,
      location: item.location,
      itemType: item.itemType
    });
    setError(null);
    setSuccess(null);
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
      const response = await fetchWithAuth(`/api/items/${item.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Update local state to reflect deletion
      setItemStatus('DELETED');
      setSuccess('Item has been deleted successfully. Redirecting...');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      
    } catch (error) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="mb-4 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back</span>
        </button>

        {/* Header Section */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-6 border border-gray-200/60">
          {isEditMode ? (
            /* EDIT MODE */
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium">✏️ Edit Mode - Update item details below</p>
              </div>
              
              {/* Title Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Item title"
                />
              </div>
              
              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Item description"
                />
              </div>
              
              {/* Location Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Where was it lost/found?"
                />
              </div>
              
              {/* Item Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="itemType"
                      value="LOST"
                      checked={editForm.itemType === 'LOST'}
                      onChange={(e) => setEditForm({...editForm, itemType: e.target.value as 'LOST' | 'FOUND'})}
                      className="mr-2"
                    />
                    <span className="text-sm">🔍 Lost</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="itemType"
                      value="FOUND"
                      checked={editForm.itemType === 'FOUND'}
                      onChange={(e) => setEditForm({...editForm, itemType: e.target.value as 'LOST' | 'FOUND'})}
                      className="mr-2"
                    />
                    <span className="text-sm">✨ Found</span>
                  </label>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editForm.title || !editForm.description || !editForm.location}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  disabled={isSaving}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* VIEW MODE */
            <>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
                    {item.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Item Type Badge */}
                    <Badge variant={item.itemType === 'LOST' ? 'destructive' : 'default'} className="px-3 py-0.5 text-xs font-semibold">
                      {item.itemType === 'LOST' ? '🔍 Lost' : '✨ Found'}
                    </Badge>
                    
                    {/* Status Badge */}
                    <Badge 
                      className={`px-3 py-0.5 text-xs font-semibold ${
                        itemStatus === 'LOST' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                        itemStatus === 'FOUND' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                        itemStatus === 'CLAIMED' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                        itemStatus === 'RESOLVED' ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' :
                        'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {itemStatus === 'RESOLVED' ? '✅ Resolved' : 
                       itemStatus === 'CLAIMED' ? '🤝 Claimed' : 
                       itemStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Location & Date */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">{item.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Posted {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {item.resolvedAt && (
                  <div className="flex items-center gap-1.5 text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Resolved {new Date(item.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Show message if item is deleted */}
        {itemStatus === 'DELETED' && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-red-800 font-semibold text-sm mb-0.5">
                  Item Deleted
                </p>
                <p className="text-red-700 text-xs">
                  This item has been deleted and is no longer available.
                </p>
                {canEdit && (
                  <p className="text-red-600 text-xs mt-1">
                    Only admins/moderators can see deleted items.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left Column - Item Details */}
          <div className="lg:col-span-2 space-y-5">
            {/* Description - Hidden in edit mode */}
            {!isEditMode && (
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200/60">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <h2 className="text-sm font-bold text-gray-900">Description</h2>
                </div>
                <div className="prose prose-sm prose-gray max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            )}

            {/* Images Section */}
            {item.images && item.images.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-sm font-bold text-gray-900">Images</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {item.images.map((image: string, index: number) => (
                    <div key={index} className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                      <img
                        src={image}
                        alt={`${item.title} - Image ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 109: Comments Section - Hide if item is deleted or user is not logged in */}
            {itemStatus !== 'DELETED' && isLoggedIn && (
              <CommentsSection itemId={item.id} itemStatus={itemStatus} />
            )}
            
            {/* Show message for non-logged-in users */}
            {!isLoggedIn && itemStatus !== 'DELETED' && (
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200/60">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h2 className="text-sm font-bold text-gray-900">Comments</h2>
                </div>
                <div className="text-center py-6">
                  <p className="text-gray-600 mb-4 text-sm">Sign in to view and add comments</p>
                  <a
                    href="/auth/login"
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Sign In
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - User Info & Actions */}
          <div className="space-y-5">
            {/* User Information - Show differently if resolved */}
            {isResolved && item.claimedBy ? (
              /* RESOLVED: Show Lost → Found flow */
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-sm font-bold text-gray-900">Resolution Details</h2>
                </div>

                {/* Lost By */}
                <div className="relative">
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Lost By
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                        {item.postedBy?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-xs truncate">
                          {item.postedBy?.name || 'Anonymous'}
                        </p>
                        <p className="text-gray-600 text-xs truncate">{item.postedBy?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center my-2">
                    <div className="flex flex-col items-center">
                      <svg className="w-6 h-6 text-green-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span className="text-xs font-bold text-green-600 mt-1">FOUND</span>
                    </div>
                  </div>

                  {/* Found By */}
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Found By
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                          {item.claimedBy?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border border-white flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-xs truncate">
                          {item.claimedBy?.name || 'Anonymous'}
                        </p>
                        <p className="text-gray-600 text-xs truncate">{item.claimedBy?.email}</p>
                      </div>
                    </div>
                    {item.resolvedAt && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">
                          {new Date(item.resolvedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* NOT RESOLVED: Show normal Posted By */
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-5 border border-blue-100/60">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 className="text-sm font-bold text-gray-900">Posted By</h2>
                </div>
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {item.postedBy?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-semibold text-sm truncate">
                      {item.postedBy?.name || 'Anonymous User'}
                    </p>
                    <p className="text-gray-600 text-xs truncate break-all">
                      {item.postedBy?.email || 'No email'}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Item Statistics */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200/60">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-xs">Views</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{item.views || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <span className="text-xs">Comments</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{item.commentCount || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs">Claims</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{item.claimCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Step 111 & 112: Actions */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200/60">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Actions
              </h3>
              
              {/* Fix: Add error/success message display */}
              {error && (
                <div className="mb-3 bg-red-50 border-l-4 border-red-500 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="mb-3 bg-green-50 border-l-4 border-green-500 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-xs text-green-700 font-medium">{success}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                {/* Step 112: Edit/Delete Buttons - Show if can edit and not in edit mode and not resolved */}
                {canEdit && itemStatus !== 'DELETED' && !isEditMode && !isResolved && (
                  <>
                    <Button
                      onClick={handleEdit}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200 text-sm h-9"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Item
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      variant="destructive"
                      className="w-full font-semibold shadow-sm hover:shadow-md transition-all duration-200 text-sm h-9"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {isDeleting ? 'Deleting...' : 'Delete Item'}
                    </Button>
                  </>
                )}
                
                {/* Step 111: Claim Button - Show if logged in and not owner and not in edit mode and not resolved */}
                {isLoggedIn && !isOwner && itemStatus !== 'DELETED' && !isEditMode && !isResolved && (
                  <Button
                    onClick={() => setIsClaimsModalOpen(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200 text-sm h-9"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Claim This Item
                  </Button>
                )}
                
                {/* Show login prompt if not logged in and not in edit mode and not resolved */}
                {!isLoggedIn && itemStatus !== 'DELETED' && !isEditMode && !isResolved && (
                  <Button
                    onClick={() => window.location.href = '/auth/login'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In to Claim
                  </Button>
                )}
                
                {/* Show owner message */}
                {isLoggedIn && isOwner && itemStatus !== 'DELETED' && !canEdit && (
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-blue-800 font-medium">
                      This is your posted item
                    </p>
                  </div>
                )}
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
