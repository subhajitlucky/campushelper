'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Edit, Trash2, Eye, Calendar, MapPin } from "lucide-react";
import EmptyState, { EmptyStateIcons } from "@/components/ui/EmptyState";
import { ListItemSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAuthFetch } from '@/lib/auth-fetch';

interface UserItem {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
  location: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  commentCount?: number;
  claimCount?: number;
}

interface UserItemsSectionProps {
  userId: string;
}

export default function UserItemsSection({ userId }: UserItemsSectionProps) {
  const { fetchWithAuth } = useAuthFetch(true);
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch items posted by this user
      const response = await fetch(`/api/items?postedById=${userId}&limit=50`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch your items');
      }
      
      const data = await response.json();
      setItems(data.items || []);
    } catch {
      setError('Failed to load your items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Handle delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently remove the item from public view. Continue?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Remove item from local state
      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch {
      setError('Failed to delete item. Please try again.');
    }
  };

  // Handle edit item - navigate to item detail page with edit mode
  const handleEditItem = (itemId: string) => {
    // Navigate to item detail page where inline editing is available
    window.location.href = `/item/${itemId}?edit=true`;
  };

  useEffect(() => {
    if (userId) {
      fetchUserItems();
    }
  }, [userId, fetchUserItems]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Posted Items</CardTitle>
          <CardDescription>Manage your lost & found items</CardDescription>
        </CardHeader>
        <CardContent>
          <ListItemSkeleton count={3} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Posted Items</CardTitle>
          <CardDescription>Manage your lost & found items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-destructive mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchUserItems} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Posted Items</CardTitle>
          <CardDescription>Manage your lost & found items</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={EmptyStateIcons.items}
            title="No items posted yet"
            action={{
              label: "Post Your First Item",
              onClick: () => window.location.href = '/post'
            }}
          />
        </CardContent>
      </Card>
    );
  }

  // Items list
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Posted Items ({items.length})</CardTitle>
        <CardDescription>Manage your lost & found items</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/40 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm mb-2 overflow-hidden" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>{item.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>💬 {item.commentCount || 0}</span>
                      <span>📋 {item.claimCount || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge 
                    variant={item.itemType === 'LOST' ? 'destructive' : 'default'}
                    className="text-xs"
                  >
                    {item.itemType}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={`text-xs ${
                      item.status === 'LOST' ? 'border-destructive/30 text-destructive' :
                      item.status === 'FOUND' ? 'border-success/30 text-success' :
                      item.status === 'CLAIMED' ? 'border-info/30 text-primary' :
                      item.status === 'RESOLVED' ? 'border-info/30 text-primary' :
                      'border-border text-foreground/85'
                    }`}
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="flex-1"
                >
                  <Link href={`/item/${item.id}`}>
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Link>
                </Button>
                
                {item.status !== 'DELETED' && item.status !== 'RESOLVED' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditItem(item.id)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/90/10 border-destructive/30 hover:border-destructive/30"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
                
                {/* Show resolved message for resolved items */}
                {item.status === 'RESOLVED' && (
                  <div className="flex-1 text-center py-2 bg-success/10 border border-success/30 rounded text-xs text-success font-medium">
                    ✅ Resolved
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
