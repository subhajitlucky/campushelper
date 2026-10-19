'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeInput } from '@/lib/security';
import { useAuthFetch } from '@/lib/auth-fetch';

interface ClaimsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  isOwner: boolean;
  onSuccess?: () => void;
}

/**
 * Claim dialog.
 *
 * A real modal, not a box in the page flow: it dims the page with the overlay
 * elevation token, closes on Escape or a backdrop click, keeps focus inside the
 * panel while it is open, and locks background scrolling. Everything the dialog
 * does with the API is unchanged.
 */
export default function ClaimsModal({ isOpen, onClose, itemId, itemTitle, isOwner, onSuccess }: ClaimsModalProps) {
  const { data: session } = useSession();
  const { fetchWithAuth } = useAuthFetch(true); // Require authentication
  const [formData, setFormData] = useState({
    claimType: 'FOUND_IT' as 'FOUND_IT' | 'OWN_IT',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close: reset the form, then hand control back to the parent.
  const close = useCallback(() => {
    setFormData({ claimType: 'FOUND_IT', message: '' });
    setError(null);
    setSuccess(null);
    onClose();
  }, [onClose]);

  // Escape closes, Tab stays inside the panel, and the page behind cannot
  // scroll. Hooks run before the early returns below so the order never changes.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog, matching where sighted attention already is.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close]);

  // Don't render if modal is not open
  if (!isOpen) return null;

  // Don't render if user is not logged in or is owner
  if (!session?.user || isOwner) return null;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.message.trim()) {
      setError('Message is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithAuth('/api/claims', {
        method: 'POST',
        body: JSON.stringify({
          claimType: formData.claimType,
          itemId: itemId,
          message: sanitizeInput(formData.message.trim())
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit claim');
      }

      await response.json();

      setSuccess('Claim submitted successfully!');

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(null);
        setFormData({ claimType: 'FOUND_IT', message: '' });
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (error) {
      setError(null);
    }
  };

  const controlClasses =
    'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claims-modal-title"
        aria-describedby="claims-modal-description"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border-strong bg-card shadow-overlay outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div className="min-w-0">
            <h2 id="claims-modal-title" className="text-xl font-semibold tracking-tight text-foreground">
              Claim this item
            </h2>
            <p id="claims-modal-description" className="mt-1 text-base leading-relaxed text-muted-foreground">
              You are claiming{' '}
              <span className="font-medium text-foreground">{itemTitle}</span>. The poster
              reviews every claim before anything is handed over.
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {/* Claim Type */}
          <div className="space-y-2">
            <Label htmlFor="claim-type">What kind of claim is this?</Label>
            <select
              id="claim-type"
              name="claimType"
              value={formData.claimType}
              onChange={handleInputChange}
              className={controlClasses}
              required
            >
              <option value="FOUND_IT">I found this item</option>
              <option value="OWN_IT">This is my lost item</option>
            </select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="claim-message">Message</Label>
            <Textarea
              id="claim-message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              placeholder="Describe how this item relates to you…"
              rows={4}
              className="resize-none"
              required
              maxLength={500}
            />
            <p className="text-xs font-medium text-muted-foreground">
              {formData.message.length}/500 characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" className="rounded-r-lg border-l-2 border-destructive bg-destructive/5 px-3 py-2">
              <p className="text-base text-destructive">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div role="status" className="rounded-r-lg border-l-2 border-success bg-success/5 px-3 py-2">
              <p className="text-base text-success">{success}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 border-t border-border-subtle pt-5">
            <Button type="button" variant="outline" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !formData.message.trim()}
            >
              Submit claim
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
