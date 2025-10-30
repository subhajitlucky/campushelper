'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

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
}

export default function CommentsSection({ itemId }: CommentsSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Step 110: Form state
  const [formData, setFormData] = useState({
    message: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: formData.message.trim(),
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
      console.error('Error posting comment:', err);
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
  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comments?itemId=${itemId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      
      const data = await response.json();
      setComments(data.comments || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove comment from local state
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Failed to delete comment. Please try again.');
    }
  };

  // Load comments on component mount
  useEffect(() => {
    fetchComments();
  }, [itemId]);

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
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Comments</h3>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchComments}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Comments ({comments.length})
      </h3>
      
      {/* Step 110: Comment Form - Only show if logged in */}
      {session?.user && (
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
      
      {/* Show login prompt if not logged in */}
      {!session?.user && (
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
          {comments.map((comment) => (
            <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-b-0">
              <div className="flex items-start gap-3">
                {/* User Avatar */}
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  {comment.user.avatar ? (
                    <img
                      src={comment.user.avatar}
                      alt={comment.user.name || 'User'}
                      className="w-8 h-8 rounded-full"
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
                  
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {comment.message}
                  </p>
                  
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
                  
                  {/* Delete Button (only for comment author) */}
                  {session?.user?.id === comment.userId && (
                    <div className="mt-2">
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="text-xs text-red-600 hover:text-red-800 hover:underline"
                      >
                        Delete
                      </button>
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
