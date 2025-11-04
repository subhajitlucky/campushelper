'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, User, Mail, Calendar, Package, MessageSquare, CheckCircle } from "lucide-react";
import EditProfileModal from "./EditProfileModal";
import { useAuthFetch } from '@/lib/auth-fetch';

interface UserProfileSectionProps {
  userStats: {
    myItems: number;
    claimsMade: number;
    resolvedItems: number;
    thisWeek: number;
  };
}

export default function UserProfileSection({ userStats }: UserProfileSectionProps) {
  const { data: session } = useSession();
  const { fetchWithAuth } = useAuthFetch(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  if (!session?.user) {
    return null;
  }

  const { name, email } = session.user;
  // Handle optional properties that may not exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userAny = session.user as any;
  const avatar = userAny.avatar as string | undefined;
  const createdAt = userAny.createdAt as string | undefined;

  // Calculate additional stats
  const successRate = userStats.claimsMade > 0 
    ? Math.round((userStats.resolvedItems / userStats.myItems) * 100) || 0
    : 0;

  // Handle profile update
  const handleProfileUpdate = async (updatedData: { name: string }) => {
    try {
      // Make API call to update user profile
      const response = await fetchWithAuth('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // On success, refresh the page to get updated session data
      window.location.reload();

    } catch (error) {
      throw error; // Re-throw to be handled by modal
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile
        </CardTitle>
        <CardDescription>
          Your account information and activity summary
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* User Info Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt={name || 'User'}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-xl">
                    {(name || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
              
              {/* User Details */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {name || 'Anonymous User'}
                </h3>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Mail className="w-3 h-3" />
                  {email}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <Calendar className="w-3 h-3" />
                  Member since {new Date(createdAt || Date.now()).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            {/* Edit Profile Button */}
            <Button onClick={() => setIsEditModalOpen(true)} variant="outline" className="w-full">
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>

          {/* Activity Stats Column */}
          <div className="lg:col-span-2">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Activity Overview</h4>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Items Posted */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <Badge variant="secondary" className="text-xs">
                    Items
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-blue-900">{userStats.myItems}</div>
                <div className="text-xs text-blue-700">Items posted</div>
              </div>

              {/* Claims Made */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <Badge variant="secondary" className="text-xs">
                    Claims
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-green-900">{userStats.claimsMade}</div>
                <div className="text-xs text-green-700">Claims submitted</div>
              </div>

              {/* Resolved Items */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  <Badge variant="secondary" className="text-xs">
                    Success
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-purple-900">{userStats.resolvedItems}</div>
                <div className="text-xs text-purple-700">Items resolved</div>
              </div>

              {/* This Week */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <Badge variant="secondary" className="text-xs">
                    Week
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-orange-900">{userStats.thisWeek}</div>
                <div className="text-xs text-orange-700">New this week</div>
              </div>
            </div>

            {/* Additional Stats Row */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Success Rate:</span>
                <span className="font-semibold text-gray-900">
                  {successRate}% ({userStats.resolvedItems}/{userStats.myItems} items)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Average Claims per Item:</span>
                <span className="font-semibold text-gray-900">
                  {userStats.myItems > 0 ? (userStats.claimsMade / userStats.myItems).toFixed(1) : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        onProfileUpdate={handleProfileUpdate}
      />
    </Card>
  );
}
