/**
 * ItemDetail Component
 * Displays comprehensive item information in a professional layout
 */

'use client';

import { useState } from 'react';
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

  // Step 111: Check if current user is the item owner
  const isOwner = session?.user?.id === item.postedBy.id;
  const isLoggedIn = !!session?.user;

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
              item.status === 'LOST' ? 'bg-red-100 text-red-800' :
              item.status === 'FOUND' ? 'bg-green-100 text-green-800' :
              item.status === 'CLAIMED' ? 'bg-blue-100 text-blue-800' :
              item.status === 'RESOLVED' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {item.status}
            </span>
            
            {/* Location */}
            <span className="text-gray-600">
              📍 {item.location}
            </span>
          </div>
        </div>

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

            {/* Step 109: Comments Section */}
            <CommentsSection itemId={item.id} />
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

            {/* Step 111: Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                {/* Step 111: Claim Button - Show if logged in and not owner */}
                {isLoggedIn && !isOwner && (
                  <button
                    onClick={() => setIsClaimsModalOpen(true)}
                    disabled={item.status === 'DELETED'}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {item.status === 'DELETED' ? 'Item Deleted' : 'Claim Item'}
                  </button>
                )}
                
                {/* Show login prompt if not logged in */}
                {!isLoggedIn && (
                  <a
                    href="/auth/login"
                    className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sign In to Claim
                  </a>
                )}
                
                {/* Show owner message */}
                {isLoggedIn && isOwner && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      This is your item
                    </p>
                  </div>
                )}
                
                {/* TODO: Add edit/delete for owners */}
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
