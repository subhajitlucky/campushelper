'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, MessageSquare, CheckCircle, Search, Plus } from "lucide-react";
import UserProfileSection from '@/components/UserProfileSection';
import UserItemsSection from '@/components/UserItemsSection';
import UserClaimsSection from '@/components/UserClaimsSection';
import IncomingClaimsSection from '@/components/IncomingClaimsSection';
// Simple PageLoader component
const PageLoader = ({ text }: { text: string }) => (
  <div className="text-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info/30 mx-auto mb-4"></div>
    <p className="text-muted-foreground">{text}</p>
  </div>
);

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
        } catch {
        }
        
        setUserStats({
          myItems,
          resolvedItems,
          thisWeek,
          claimsMade
        });
      }
    } catch {
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
    const loadingText = status === 'loading' ? 'Checking authentication...' : 'Loading dashboard...';
    return (
      <div className="min-h-screen bg-muted/40 py-8">
        <div className="container mx-auto px-4">
          <PageLoader text={loadingText} />
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-6">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Step 118: User Profile Section */}
        <div className="mb-6">
          <UserProfileSection userStats={userStats} />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/85">My Items</CardTitle>
              <Package className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{userStats.myItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Items posted</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/85">Claims Made</CardTitle>
              <MessageSquare className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{userStats.claimsMade}</div>
              <p className="text-xs text-muted-foreground mt-1">Claims submitted</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/85">Resolved</CardTitle>
              <CheckCircle className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{userStats.resolvedItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Items resolved</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/85">This Week</CardTitle>
              <Search className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{userStats.thisWeek}</div>
              <p className="text-xs text-muted-foreground mt-1">New items posted</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-info/30">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>
              Get started with common tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1 bg-primary hover:bg-primary/90">
                <Link href="/post">
                  <Plus className="mr-2 h-4 w-4" />
                  Post New Item
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1 border-info/30 hover:bg-info/90/10">
                <Link href="/search">
                  <Search className="mr-2 h-4 w-4" />
                  Search Items
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 115: User's Posted Items Section */}
        <div className="mb-6">
          <UserItemsSection userId={session?.user?.id || ''} />
        </div>

        {/* Step 116: User's Claims Section */}
        <div className="mb-6">
          <UserClaimsSection userId={session?.user?.id || ''} />
        </div>

        {/* Step 117: Incoming Claims Section */}
        <div className="mb-6">
          <IncomingClaimsSection userId={session?.user?.id || ''} />
        </div>
      </div>
    </div>
  );
}
