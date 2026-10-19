'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { MessageSquare, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import SectionHeader from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeInput } from '@/lib/security';
import { formatRelativeTime } from '@/lib/notification-display';
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

/**
 * Comments for one item.
 *
 * Deliberately containerless (brief §4.1): a `SectionHeader`, then the form,
 * then the list — no wrapping card and no grey inner box around the form. The
 * empty state *replaces* the list rather than sitting underneath the form, which
 * is what made the old layout look broken.
 */
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

    } catch {
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
    } catch {
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
    } catch {
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
      <section aria-labelledby="comments-heading" aria-busy="true">
        <SectionHeader id="comments-heading" title="Comments" />

        <div className="mt-6 space-y-6" role="status" aria-label="Loading comments">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    const isAuthError = error.includes('Authentication required') || error.includes('Authentication');

    return (
      <section aria-labelledby="comments-heading">
        <SectionHeader id="comments-heading" title="Comments" />

        <div role="alert" className="mt-6 rounded-r-lg border-l-2 border-destructive bg-destructive/5 px-4 py-3">
          <p className="text-base text-destructive">{error}</p>
        </div>

        <div className="mt-4">
          {isAuthError ? (
            <Button asChild>
              <Link href="/auth/login">Sign in to view comments</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={fetchComments}>
              Try again
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="comments-heading">
      <SectionHeader id="comments-heading" title={`Comments (${comments.length})`} />

      {/* Show info message for resolved items */}
      {itemStatus === 'RESOLVED' && (
        <p className="mt-4 flex items-start gap-2 text-base text-success">
          <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This item is resolved, so the thread is read-only now.
        </p>
      )}

      {/* Step 110: Comment Form - Only show if logged in and item is not resolved */}
      {session?.user && itemStatus !== 'RESOLVED' && (
        <form onSubmit={submitComment} className="mt-6">
          <label htmlFor="comment-message" className="block text-sm font-medium text-foreground">
            Add a comment
          </label>

          <Textarea
            id="comment-message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            placeholder="Write your comment here…"
            rows={3}
            maxLength={1000}
            disabled={formLoading}
            className="mt-2 resize-none text-base"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {formError ? (
                <p role="alert" className="text-base text-destructive">{formError}</p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  {formData.message.length}/1000
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={formLoading || !formData.message.trim()}
            >
              {formLoading ? 'Posting…' : 'Post comment'}
            </Button>
          </div>
        </form>
      )}

      {/* Show login prompt if not logged in and item is not resolved */}
      {!session?.user && itemStatus !== 'RESOLVED' && (
        <div className="mt-6">
          <p className="text-base text-muted-foreground">Sign in to add a comment.</p>
          <Button asChild className="mt-4">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      )}

      {/* Comments List — the empty state replaces the list, it does not sit below the form */}
      {comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare aria-hidden="true" />}
          title="No comments yet"
          description="Be the first to reply on this report."
        />
      ) : (
        <>
          {/* Fix: Add delete error display */}
          {deleteError && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-r-lg border-l-2 border-destructive bg-destructive/5 px-4 py-3"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-base text-destructive">{deleteError}</p>
              <button
                type="button"
                onClick={() => setDeleteError(null)}
                aria-label="Dismiss error"
                className="ml-auto rounded text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <ul className="mt-6 divide-y divide-border-subtle">
            {comments.map((comment) => (
              <li key={comment.id} className="py-6 first:pt-0">
                <div className="flex items-start gap-3">
                  {/* User Avatar */}
                  <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {comment.user.avatar ? (
                      <Image
                        src={comment.user.avatar}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        {(comment.user.name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Comment Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {comment.user.name || 'Anonymous'}
                      </p>
                      <time
                        dateTime={comment.createdAt}
                        title={new Date(comment.createdAt).toLocaleString()}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {formatRelativeTime(comment.createdAt)}
                      </time>
                    </div>

                    {/* Comment Message - Edit Mode or Display Mode */}
                    {editingCommentId === comment.id ? (
                      // Edit Mode
                      <div className="mt-3">
                        <Textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          rows={3}
                          placeholder="Edit your comment…"
                          disabled={editLoading}
                          aria-label="Edit comment"
                          className="resize-none text-base"
                        />
                        {editError && (
                          <p role="alert" className="mt-2 text-base text-destructive">{editError}</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEditComment(comment.id)}
                            disabled={editLoading || !editMessage.trim()}
                          >
                            {editLoading ? 'Saving…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} disabled={editLoading}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display Mode
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-base text-foreground/85">
                        {comment.message}
                      </p>
                    )}

                    {/* Comment Images */}
                    {comment.images && comment.images.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {comment.images.map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Comment image ${index + 1}`}
                            className="h-24 w-full rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Action Buttons (only for comment author, not on resolved items) */}
                    {session?.user?.id === comment.userId && itemStatus !== 'RESOLVED' && itemStatus !== 'DELETED' && (
                      <div className="mt-3 flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => startEditComment(comment)}
                          disabled={editingCommentId === comment.id}
                          className="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteComment(comment.id)}
                          className="rounded text-xs font-medium text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {/* Show resolved message if item is resolved */}
                    {itemStatus === 'RESOLVED' && session?.user?.id === comment.userId && (
                      <p className="mt-2 text-sm font-medium text-muted-foreground">
                        Comments are locked after resolution
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
