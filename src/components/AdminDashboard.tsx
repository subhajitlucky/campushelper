'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from '@/lib/toast-config';
import { 
  Users, 
  Package, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Shield,
  Eye,
  Trash2,
  Flag
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalItems: number;
  totalClaims: number;
  pendingClaims: number;
  activeItems: number;
  resolvedItems: number;
  deletedItems: number;
}

interface AdminItem {
  id: string;
  title: string;
  description: string;
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
  itemType: 'LOST' | 'FOUND';
  location: string;
  createdAt: string;
  postedBy: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
  };
  claimCount: number;
  commentCount: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  isActive: boolean;
  createdAt: string;
  itemsCount: number;
  claimsCount: number;
}

interface AdminClaim {
  id: string;
  claimType: 'FOUND_IT' | 'OWN_IT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message: string;
  createdAt: string;
  item: {
    id: string;
    title: string;
    status: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'users' | 'claims'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add moderation state and handlers
  const [moderatingItem, setModeratingItem] = useState<string | null>(null);

  // Handle item moderation actions
  const handleItemModeration = async (itemId: string, action: 'force_delete' | 'flag_spam' | 'unflag_spam') => {
    let confirmMessage = '';
    
    switch (action) {
      case 'force_delete':
        confirmMessage = 'Are you sure you want to force delete this item? This will permanently remove it and all its comments.';
        break;
      case 'flag_spam':
        confirmMessage = 'Are you sure you want to flag this item as spam? It will be hidden from public view.';
        break;
      case 'unflag_spam':
        confirmMessage = 'Are you sure you want to unflag this item? It will be restored to public view.';
        break;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setModeratingItem(itemId);

    try {
      const response = await fetch(`/api/admin/items/${itemId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Moderation action failed');
      }

      const data = await response.json();
      
      // Show success message
      showSuccess(data.message);
      
      // Refresh the items list
      await fetchAdminData();
      
    } catch (err) {
      showError('Failed to perform moderation action. Please try again.');
    } finally {
      setModeratingItem(null);
    }
  };

  // Add user moderation state and handlers
  const [moderatingUser, setModeratingUser] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Handle user moderation actions
  const handleUserModeration = async (userId: string, action: 'suspend' | 'activate') => {
    const actionText = action === 'suspend' ? 'suspend' : 'activate';
    const confirmMessage = `Are you sure you want to ${actionText} this user? They will ${action === 'suspend' ? 'lose access to their account' : 'regain access to their account'}.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setModeratingUser(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'User moderation action failed');
      }

      const data = await response.json();
      
      // Show success message
      showSuccess(data.message);
      
      // Refresh the users list
      await fetchAdminData();
      
    } catch (err) {
      showError('Failed to perform moderation action. Please try again.');
    } finally {
      setModeratingUser(null);
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    setModeratingUser(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'change_role', newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Role change failed');
      }

      const data = await response.json();
      
      // Show success message
      showSuccess(data.message);
      
      // Refresh the users list
      await fetchAdminData();
      
    } catch (err) {
      showError('Failed to change role. Please try again.');
    } finally {
      setModeratingUser(null);
      setShowRoleModal(false);
      setSelectedUser(null);
    }
  };

  // Get button configuration based on item status
  const getModerationButtons = (item: AdminItem) => {
    const isDeleted = item.status === 'DELETED';
    const isSpam = item.status === 'RESOLVED' && item.title.includes('[SPAM]'); // Simple spam detection
    const isModerating = moderatingItem === item.id;

    return (
      <div className="flex gap-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => window.open(`/item/${item.id}`, '_blank')}
          disabled={isModerating}
        >
          <Eye className="w-4 h-4 mr-2" />
          View
        </Button>
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleItemModeration(item.id, isSpam ? 'unflag_spam' : 'flag_spam')}
          disabled={isModerating || isDeleted}
          className={isSpam ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : ''}
        >
          <Flag className="w-4 h-4 mr-2" />
          {isModerating ? 'Processing...' : (isSpam ? 'Unflag' : 'Flag Spam')}
        </Button>
        
        {item.status !== 'DELETED' && (
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => handleItemModeration(item.id, 'force_delete')}
            disabled={isModerating}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isModerating ? 'Processing...' : 'Force Delete'}
          </Button>
        )}
      </div>
    );
  };

  // Get user action buttons
  const getUserActionButtons = (user: AdminUser) => {
    const isModerating = moderatingUser === user.id;
    const isOwnAccount = session?.user?.id === user.id; // Prevent self-modification

    return (
      <div className="flex gap-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => window.open(`/dashboard?user=${user.id}`, '_blank')}
          disabled={isModerating}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Profile
        </Button>
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {/* TODO: Implement user items view */}}
          disabled={isModerating}
        >
          <Package className="w-4 h-4 mr-2" />
          View Items
        </Button>
        
        {!isOwnAccount && user.role === 'USER' && (
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => handleUserModeration(user.id, user.isActive ? 'suspend' : 'activate')}
            disabled={isModerating}
          >
            <XCircle className="w-4 h-4 mr-2" />
            {isModerating ? 'Processing...' : (user.isActive ? 'Suspend' : 'Activate')}
          </Button>
        )}
        
        {!isOwnAccount && user.role !== 'USER' && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              setSelectedUser(user);
              setShowRoleModal(true);
            }}
            disabled={isModerating}
          >
            <Shield className="w-4 h-4 mr-2" />
            Change Role
          </Button>
        )}
      </div>
    );
  };

  // Check admin authorization
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';
  
  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin, activeTab]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch overview stats
      if (activeTab === 'overview') {
        const statsResponse = await fetch('/api/admin/stats', {
          credentials: 'include',
        });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      }

      // Fetch items
      if (activeTab === 'items') {
        const itemsResponse = await fetch('/api/admin/items', {
          credentials: 'include',
        });
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setItems(itemsData.items || []);
        }
      }

      // Fetch users
      if (activeTab === 'users') {
        const usersResponse = await fetch('/api/admin/users', {
          credentials: 'include',
        });
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.users || []);
        }
      }

      // Fetch claims
      if (activeTab === 'claims') {
        const claimsResponse = await fetch('/api/admin/claims', {
          credentials: 'include',
        });
        if (claimsResponse.ok) {
          const claimsData = await claimsResponse.json();
          setClaims(claimsData.claims || []);
        }
      }
    } catch (err) {
      showError('Failed to load admin data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome back, {session?.user?.name || session?.user?.email}. Manage your campus community.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'overview'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'items'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Items
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'users'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'claims'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Claims
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
            <Button 
              onClick={fetchAdminData} 
              variant="outline" 
              size="sm" 
              className="ml-auto"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-gray-600">
                    {stats.totalUsers - stats.activeItems} inactive
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                  <Package className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalItems}</div>
                  <p className="text-xs text-gray-600">
                    {stats.resolvedItems} resolved
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
                  <MessageSquare className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingClaims}</div>
                  <p className="text-xs text-gray-600">
                    {stats.totalClaims} total claims
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Deleted Items</CardTitle>
                  <Trash2 className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.deletedItems}</div>
                  <p className="text-xs text-gray-600">
                    {stats.activeItems} active
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">All Items</h2>
                <Button onClick={fetchAdminData} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="grid gap-6">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <CardDescription>
                            {item.itemType} • {item.location} • {item.status}
                          </CardDescription>
                        </div>
                        <Badge 
                          variant={
                            item.status === 'DELETED' ? 'destructive' :
                            item.status === 'RESOLVED' ? 'default' : 'secondary'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {item.description}
                        </p>
                        
                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            <span>By: {item.postedBy.name || item.postedBy.email}</span>
                            <span>{item.commentCount} comments</span>
                            <span>{item.claimCount} claims</span>
                          </div>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex gap-2">
                          {getModerationButtons(item)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">All Users</h2>
                <Button onClick={fetchAdminData} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="grid gap-6">
                {users.map((user) => (
                  <Card key={user.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {user.name || 'Anonymous User'}
                          </CardTitle>
                          <CardDescription>
                            {user.email}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              user.role === 'ADMIN' ? 'default' :
                              user.role === 'MODERATOR' ? 'secondary' : 'outline'
                            }
                          >
                            {user.role}
                          </Badge>
                          <Badge variant={user.isActive ? 'default' : 'destructive'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <div className="flex items-center space-x-4">
                          <span>{user.itemsCount} items posted</span>
                          <span>{user.claimsCount} claims made</span>
                        </div>
                        <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {getUserActionButtons(user)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Claims Tab */}
          {activeTab === 'claims' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">All Claims</h2>
                <Button onClick={fetchAdminData} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="grid gap-6">
                {claims.map((claim) => (
                  <Card key={claim.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {claim.claimType.replace('_', ' ')} Claim
                          </CardTitle>
                          <CardDescription>
                            Item: {claim.item.title}
                          </CardDescription>
                        </div>
                        <Badge 
                          variant={
                            claim.status === 'APPROVED' ? 'default' :
                            claim.status === 'REJECTED' ? 'destructive' : 'secondary'
                          }
                        >
                          {claim.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                          <strong>Claimant:</strong> {claim.user.name || claim.user.email}
                        </p>
                        
                        <p className="text-sm text-gray-600">
                          <strong>Message:</strong> {claim.message}
                        </p>

                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <span>Item Status: {claim.item.status}</span>
                          <span>{new Date(claim.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-2" />
                            View Item
                          </Button>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-2" />
                            View Claimant
                          </Button>
                          {claim.status === 'PENDING' && (
                            <>
                              <Button size="sm" variant="default">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive">
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Change User Role</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                User: {selectedUser.name || selectedUser.email}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Current Role: <Badge variant="outline">{selectedUser.role}</Badge>
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block text-sm font-medium text-gray-700">
                Select New Role
              </label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                defaultValue=""
                id="newRoleSelect"
              >
                <option value="" disabled>Choose a role...</option>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                {session?.user?.role === 'ADMIN' && (
                  <option value="ADMIN">ADMIN</option>
                )}
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const select = document.getElementById('newRoleSelect') as HTMLSelectElement;
                  const newRole = select?.value;
                  
                  if (!newRole) {
                    showError('Please select a role');
                    return;
                  }
                  
                  if (newRole === selectedUser.role) {
                    showError('User already has this role');
                    return;
                  }
                  
                  handleRoleChange(selectedUser.id, newRole);
                }}
                className="flex-1"
                disabled={moderatingUser === selectedUser.id}
              >
                {moderatingUser === selectedUser.id ? 'Changing...' : 'Change Role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
