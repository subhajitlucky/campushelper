'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, Plus, Package, MessageSquare, CheckCircle } from "lucide-react";

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

  // Fetch user stats when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchUserStats();
    }
  }, [status, session?.user?.id]);

  // For Step 114, let's keep it simple and just show placeholder stats
  // We'll implement real data fetching in the next steps
  const fetchUserStats = async () => {
    try {
      setLoading(true);
      
      // For now, keep placeholder values
      // Real implementation will come in Step 115
      setUserStats({
        myItems: 0,
        claimsMade: 0,
        resolvedItems: 0,
        thisWeek: 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
              <p className="text-xs text-gray-600">New items found</p>
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

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Recent Items</CardTitle>
              <CardDescription>
                Items you've posted recently
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No items posted yet</p>
                <Button asChild className="mt-4">
                  <Link href="/post">Post Your First Item</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Claims</CardTitle>
              <CardDescription>
                Claims you've made on items
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No claims made yet</p>
                <Button variant="outline" asChild className="mt-4">
                  <Link href="/search">Browse Items to Claim</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
