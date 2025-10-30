'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, Plus, Package, MessageSquare, CheckCircle } from "lucide-react";
import UserItemsSection from "@/components/UserItemsSection";
import UserClaimsSection from "@/components/UserClaimsSection";
import IncomingClaimsSection from "@/components/IncomingClaimsSection";
import UserProfileSection from "@/components/UserProfileSection";

/**
 * Dashboard Page - Protected Route
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userStats, setUserStats] = useState({
    myItems: 0,
    claimsMade: 0,
    resolvedItems: 0,
    thisWeek: 0
  });
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard');
    }
  }, [status, router]);

  // Fetch real user stats from API
  const fetchUserStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch user's items using postedById filter
      const itemsResponse = await fetch(`/api/items?postedById=${session?.user?.id}&limit=100`);
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        const items = itemsData.items || [];
        
        // Calculate item stats from real data
        const myItems = items.length;
        const resolvedItems = items.filter((item: { status: string }) => 
          item.status === 'RESOLVED' || item.status === 'CLAIMED'
        ).length;
        
        // Calculate this week's items
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thisWeek = items.filter((item: { createdAt: string }) => 
          new Date(item.createdAt) > oneWeekAgo
        ).length;
        
        // Fetch user's claims
        let claimsMade = 0;
        try {
          const claimsResponse = await fetch(`/api/claims?userId=${session?.user?.id}`);
          if (claimsResponse.ok) {
            const claimsData = await claimsResponse.json();
            claimsMade = claimsData.claims?.length || 0;
          }
        } catch (claimsError) {
          console.error('Error fetching claims:', claimsError);
        }
        
        setUserStats({
          myItems,
          resolvedItems,
          thisWeek,
          claimsMade
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch user stats when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchUserStats();
    }
  }, [status, session?.user?.id, fetchUserStats]);

  // Show loading while checking authentication or fetching data
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
              <p className="text-gray-600">
                {status === 'loading' ? 'Checking authentication...' : 'Loading dashboard...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {session?.user?.name || 'User'}! Manage your lost & found items and track your activity.
          </p>
        </div>

        {/* Step 118: User Profile Section */}
        <div className="mb-8">
          <UserProfileSection userStats={userStats} />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Items</CardTitle>
              <Package className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.myItems}</div>
              <p className="text-xs text-gray-600">Items posted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Claims Made</CardTitle>
              <MessageSquare className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.claimsMade}</div>
              <p className="text-xs text-gray-600">Claims submitted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.resolvedItems}</div>
              <p className="text-xs text-gray-600">Items resolved</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Search className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.thisWeek}</div>
              <p className="text-xs text-gray-600">New items posted</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with common tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/post">
                  <Plus className="mr-2 h-4 w-4" />
                  Post New Item
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/search">
                  <Search className="mr-2 h-4 w-4" />
                  Search Items
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 115: User's Posted Items Section */}
        <div className="mb-8">
          <UserItemsSection userId={session?.user?.id || ''} />
        </div>

        {/* Step 116: User's Claims Section */}
        <div className="mb-8">
          <UserClaimsSection userId={session?.user?.id || ''} />
        </div>

        {/* Step 117: Incoming Claims Section */}
        <div className="mb-8">
          <IncomingClaimsSection userId={session?.user?.id || ''} />
        </div>
      </div>
    </div>
  );
}
