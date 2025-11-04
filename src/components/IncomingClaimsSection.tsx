'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CheckCircle, XCircle, User, Calendar, MessageSquare, Eye, AlertCircle } from "lucide-react";
import { useAuthFetch } from '@/lib/auth-fetch';

interface IncomingClaim {
  id: string;
  claimType: 'FOUND_IT' | 'OWN_IT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message: string | null;
  itemId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  item: {
    id: string;
    title: string;
  };
}

interface IncomingClaimsSectionProps {
  userId: string;
}

export default function IncomingClaimsSection({ userId }: IncomingClaimsSectionProps) {
  const { data: session } = useSession();
  const { fetchWithAuth } = useAuthFetch(true);
  const [claims, setClaims] = useState<IncomingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null);

  const fetchIncomingClaims = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First fetch user's items
      const itemsResponse = await fetch(`/api/items?postedById=${userId}&limit=100`, {
        credentials: 'include'
      });
      if (!itemsResponse.ok) {
        throw new Error('Failed to fetch your items');
      }

      const itemsData = await itemsResponse.json();
      const userItems = itemsData.items || [];

      if (userItems.length === 0) {
        setClaims([]);
        return;
      }

      // Extract item IDs
      const itemIds = userItems.map((item: { id: string }) => item.id);

      // Fetch claims for all user's items
      const claimsPromises = itemIds.map(async (itemId: string) => {
        try {
          const response = await fetch(`/api/claims?itemId=${itemId}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            return data.claims || [];
          }
        } catch (err) {
          setError(`Error fetching claims for item ${itemId}: ${err}`);
          return [];
        }
      });
      
      // Wait for all claims requests to complete
      const claimsResults = await Promise.all(claimsPromises);
      
      // Flatten and sort claims by creation date
      const allClaims = claimsResults.flat();
      allClaims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setClaims(allClaims);
    } catch (err) {
      setError('Failed to load incoming claims. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle approve claim
  const handleApproveClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to approve this claim? This will update the item status.')) {
      return;
    }

    setProcessingClaimId(claimId);

    try {
      const response = await fetchWithAuth(`/api/claims/${claimId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'APPROVED'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve claim');
      }

      // Update local state
      setClaims(prev => prev.map(claim => 
        claim.id === claimId 
          ? { ...claim, status: 'APPROVED', resolvedAt: new Date().toISOString() }
          : claim
      ));
    } catch (error) {
      setError('Failed to approve claim. Please try again.');
    } finally {
      setProcessingClaimId(null);
    }
  };

  // Handle reject claim
  const handleRejectClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to reject this claim?')) {
      return;
    }

    setProcessingClaimId(claimId);

    try {
      const response = await fetchWithAuth(`/api/claims/${claimId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'REJECTED'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject claim');
      }

      // Update local state
      setClaims(prev => prev.map(claim =>
        claim.id === claimId
          ? { ...claim, status: 'REJECTED', resolvedAt: new Date().toISOString() }
          : claim
      ));
    } catch (error) {
      setError('Failed to reject claim. Please try again.');
    } finally {
      setProcessingClaimId(null);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchIncomingClaims();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter to show only pending claims by default
  const pendingClaims = claims.filter(claim => claim.status === 'PENDING');
  const resolvedClaims = claims.filter(claim => claim.status !== 'PENDING');

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claims on Your Items</CardTitle>
          <CardDescription>Manage claims made on your posted items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="flex gap-2 mt-3">
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claims on Your Items</CardTitle>
          <CardDescription>Manage claims made on your posted items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchIncomingClaims} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (claims.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claims on Your Items</CardTitle>
          <CardDescription>Manage claims made on your posted items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <MessageSquare className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 mb-4">No claims received yet</p>
            <Button asChild>
              <Link href="/dashboard">View Your Items</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Claims list
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claims on Your Items ({pendingClaims.length} pending)</CardTitle>
        <CardDescription>Manage claims made on your posted items</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Pending Claims Section */}
          {pendingClaims.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-700">
                Pending Claims ({pendingClaims.length})
              </h3>
              <div className="space-y-4">
                {pendingClaims.map((claim) => (
                  <div key={claim.id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg text-gray-900 mb-1">
                          {claim.item.title}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {claim.user.name || claim.user.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(claim.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {claim.message && (
                          <p className="text-gray-700 text-sm mb-2 p-2 bg-white rounded border">
                            &ldquo;{claim.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge 
                          variant={claim.claimType === 'FOUND_IT' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {claim.claimType === 'FOUND_IT' ? 'Found Item' : 'Owns Item'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-3 border-t border-orange-200">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/item/${claim.itemId}`}>
                          <Eye className="w-3 h-3 mr-1" />
                          View Item
                        </Link>
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleRejectClaim(claim.id)}
                        disabled={processingClaimId === claim.id}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        {processingClaimId === claim.id ? 'Processing...' : 'Reject'}
                      </Button>
                      
                      <Button 
                        size="sm" 
                        onClick={() => handleApproveClaim(claim.id)}
                        disabled={processingClaimId === claim.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {processingClaimId === claim.id ? 'Processing...' : 'Approve'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved Claims Section */}
          {resolvedClaims.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-700">
                Resolved Claims ({resolvedClaims.length})
              </h3>
              <div className="space-y-3">
                {resolvedClaims.slice(0, 5).map((claim) => (
                  <div key={claim.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">
                          {claim.item.title}
                        </p>
                        <p className="text-xs text-gray-600">
                          {claim.user.name || claim.user.email} • {new Date(claim.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            claim.status === 'APPROVED' ? 'border-green-300 text-green-700' :
                            'border-red-300 text-red-700'
                          }`}
                        >
                          {claim.status}
                        </Badge>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/item/${claim.itemId}`}>
                            <Eye className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {resolvedClaims.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    And {resolvedClaims.length - 5} more resolved claims...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
