'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { sanitizeInput } from '@/lib/security';
import { useAuthFetch } from '@/lib/auth-fetch';

interface Comment {
  id: string;
  message: string;
  images: string[];
  itemId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
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

interface CommentsSectionProps {
  itemId: string;
  itemStatus: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
}

export default function CommentsSection({ itemId, itemStatus }: CommentsSectionProps) {
  const { data: session } = useSession();
  const { fetchWithAuth } = useAuthFetch(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Step 110: Form state
  const [formData, setFormData] = useState({
    message: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fix: Add delete error state
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add edit functionality state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Step 110: Form validation
  const validateForm = () => {
    const message = formData.message.trim();
    if (message.length < 1) {
      setFormError('Comment message is required');
      return false;
    }
    if (message.length > 1000) {
      setFormError('Comment message must be 1000 characters or less');
      return false;
    }
    return true;
  };

  // Step 110: Submit comment
  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const response = await fetchWithAuth('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          message: sanitizeInput(formData.message.trim()),
          itemId: itemId,
          images: [] // For now, no images in comments
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const data = await response.json();

      // Step 110: Clear form and add comment to list
      setFormData({ message: '' });

      // Add new comment to the top of the list
      setComments(prev => [data.comment, ...prev]);

    } catch (err) {
      setFormError('Failed to post comment. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  // Step 110: Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear form error when user starts typing
    if (formError) {
      setFormError(null);
    }
  };

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comments?itemId=${itemId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        // Handle authentication errors for non-resolved items
        if (response.status === 401) {
          const data = await response.json();
          throw new Error(data.error || 'Authentication required');
        }
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.comments || []);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load comments');
      }
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove comment from local state
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      setDeleteError('Failed to delete comment. Please try again.');
    }
  };

  // Start editing a comment
  const startEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditMessage(comment.message);
    setEditError(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditMessage('');
    setEditError(null);
  };

  // Save edited comment
  const saveEditComment = async (commentId: string) => {
    if (!editMessage.trim()) {
      setEditError('Comment message is required');
      return;
    }

    if (editMessage.trim().length > 1000) {
      setEditError('Comment message must be 1000 characters or less');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const response = await fetchWithAuth(`/api/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: editMessage.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      // Update comment in local state
      setComments(prev => prev.map(comment =>
        comment.id === commentId
          ? { ...comment, message: editMessage.trim(), updatedAt: new Date().toISOString() }
          : comment
      ));

      // Exit edit mode
      setEditingCommentId(null);
      setEditMessage('');
    } catch (err) {
      setEditError('Failed to update comment. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  // Load comments on component mount
  useEffect(() => {
    fetchComments();
  }, [itemId, fetchComments]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Comments</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('Authentication required') || error.includes('Authentication');
    
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Comments</h3>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">{error}</p>
          {isAuthError ? (
            <a
              href="/auth/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In to View Comments
            </a>
          ) : (
            <button
              onClick={fetchComments}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Comments ({comments.length})
      </h3>
      
      {/* Show info message for resolved items */}
      {itemStatus === 'RESOLVED' && (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-green-800 font-semibold text-sm mb-1">
                Item Resolved
              </p>
              <p className="text-green-700 text-xs">
                This item has been resolved. You can view existing comments but cannot add new ones.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Step 110: Comment Form - Only show if logged in and item is not resolved */}
      {session?.user && itemStatus !== 'RESOLVED' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Add a Comment</h4>
          <form onSubmit={submitComment}>
            <div className="space-y-3">
              <div>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Write your comment here..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  disabled={formLoading}
                />
                <div className="flex justify-between items-center mt-1">
                  {formError && (
                    <p className="text-sm text-red-600">{formError}</p>
                  )}
                  <p className={`text-sm ml-auto ${
                    formData.message.length > 1000 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formData.message.length}/1000
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={formLoading || !formData.message.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {formLoading ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      
      {/* Show login prompt if not logged in and item is not resolved */}
      {!session?.user && itemStatus !== 'RESOLVED' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-600 mb-3">Sign in to add a comment</p>
          <a
            href="/auth/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </a>
        </div>
      )}
      
      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fix: Add delete error display */}
          {deleteError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{deleteError}</p>
                <button
                  onClick={() => setDeleteError(null)}
                  className="ml-auto text-red-600 hover:text-red-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-b-0">
              <div className="flex items-start gap-3">
                {/* User Avatar */}
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  {comment.user.avatar ? (
                    <Image
                      src={comment.user.avatar}
                      alt={comment.user.name || 'User'}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-600 text-sm font-medium">
                      {(comment.user.name || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                
                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {comment.user.name || 'Anonymous'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString()} at{' '}
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  {/* Comment Message - Edit Mode or Display Mode */}
                  {editingCommentId === comment.id ? (
                    // Edit Mode
                    <div className="mt-2">
                      <textarea
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder="Edit your comment..."
                        disabled={editLoading}
                      />
                      {editError && (
                        <p className="text-sm text-red-600 mt-1">{editError}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveEditComment(comment.id)}
                          disabled={editLoading || !editMessage.trim()}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {editLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={editLoading}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display Mode
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {comment.message}
                    </p>
                  )}
                  
                  {/* Comment Images */}
                  {comment.images && comment.images.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {comment.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Comment image ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Action Buttons (only for comment author, not on resolved items) */}
                  {session?.user?.id === comment.userId && itemStatus !== 'RESOLVED' && itemStatus !== 'DELETED' && (
                    <div className="mt-2 flex gap-3">
                      <button
                        onClick={() => startEditComment(comment)}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        disabled={editingCommentId === comment.id}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="text-xs text-red-600 hover:text-red-800 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  
                  {/* Show resolved message if item is resolved */}
                  {itemStatus === 'RESOLVED' && session?.user?.id === comment.userId && (
                    <div className="mt-2 text-xs text-gray-500">
                      Comments are locked after resolution
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
