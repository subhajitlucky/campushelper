'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Eye, Calendar, MessageSquare, AlertCircle } from "lucide-react";

interface UserClaim {
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

interface UserClaimsSectionProps {
  userId: string;
}

export default function UserClaimsSection({ userId }: UserClaimsSectionProps) {
  const [claims, setClaims] = useState<UserClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchUserClaims = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch claims made by this user
      const response = await fetch(`/api/claims?userId=${userId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch your claims');
      }
      
      const data = await response.json();
      setClaims(data.claims || []);
    } catch (err) {
      setError('Failed to load your claims. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel claim (placeholder for future implementation)
  const handleCancelClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to cancel this claim?')) {
      return;
    }

    try {
      // TODO: Implement cancel claim API endpoint
      // Cancel claim initiated
      // For now, just remove from local state
      setClaims(prev => prev.filter(claim => claim.id !== claimId));
    } catch (error) {
      setError('Failed to cancel claim. Please try again.');
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserClaims();
    }
  }, [userId]); 

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Claims</CardTitle>
          <CardDescription>Claims you&apos;ve made on items</CardDescription>
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
          <CardTitle>Your Claims</CardTitle>
          <CardDescription>Claims you&apos;ve made on items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchUserClaims} variant="outline">
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
          <CardTitle>Your Claims</CardTitle>
          <CardDescription>Claims you&apos;ve made on items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <MessageSquare className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 mb-4">No claims made yet</p>
            <Button asChild>
              <Link href="/search">Browse Items to Claim</Link>
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
        <CardTitle>Your Claims ({claims.length})</CardTitle>
        <CardDescription>Claims you&apos;ve made on items</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {claims.map((claim) => (
            <div key={claim.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">
                    {claim.item.title}
                  </h3>
                  {claim.message && (
                    <p className="text-gray-600 text-sm mb-2">{claim.message}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </div>
                    {claim.resolvedAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Resolved {new Date(claim.resolvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge 
                    variant={claim.claimType === 'FOUND_IT' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {claim.claimType === 'FOUND_IT' ? 'I Found This' : 'This is Mine'}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={`text-xs ${
                      claim.status === 'PENDING' ? 'border-yellow-300 text-yellow-700' :
                      claim.status === 'APPROVED' ? 'border-green-300 text-green-700' :
                      'border-red-300 text-red-700'
                    }`}
                  >
                    {claim.status}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-3 border-t">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/item/${claim.itemId}`}>
                    <Eye className="w-3 h-3 mr-1" />
                    View Item
                  </Link>
                </Button>
                
                {claim.status === 'PENDING' && (
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleCancelClaim(claim.id)}
                  >
                    Cancel Claim
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
