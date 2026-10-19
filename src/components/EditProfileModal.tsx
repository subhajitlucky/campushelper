'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves once the profile PUT has been accepted; a rejection is shown inline. */
  onProfileUpdate: (updatedData: { name: string }) => void | Promise<void>;
}

/** Everything focusable inside the dialog, for the Tab wrap. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * EditProfileModal
 *
 * A real dialog rather than a `<div>` that happens to sit on top of the page:
 * `role="dialog"` + `aria-modal`, an accessible name through `aria-labelledby`,
 * a described body through `aria-describedby`, focus moved into the dialog on
 * open and returned to the trigger on close, Tab wrapped inside it, Escape and a
 * backdrop click to dismiss, and page scroll locked while it is open.
 *
 * The surface is the one overlay elevation (`shadow-overlay`) at `rounded-xl`,
 * with a title / body / actions hierarchy separated by hairlines instead of
 * three competing borders. Error copy is plain `text-destructive` above the
 * fields — no tinted error box.
 *
 * The scrim uses semantic tokens only: a dark wash in light mode, the page
 * colour in dark mode (a single scrim token cannot darken *both* a white and a
 * near-black page, and a light scrim in dark mode is the exact "light surface in
 * dark mode" failure the brief warns about). `backdrop-blur-sm` carries the
 * separation in the light theme.
 */
export default function EditProfileModal({
  isOpen,
  onClose,
  onProfileUpdate,
}: EditProfileModalProps) {
  const { data: session } = useSession();
  const sessionName = session?.user?.name ?? '';

  const [formData, setFormData] = useState({ name: sessionName });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = `${titleId}-error`;

  const handleClose = useCallback(() => {
    // Dismissing mid-save would strand the request; the dialog stays put until
    // it settles, and the close controls are disabled meanwhile.
    if (loading) return;

    setFormData({ name: sessionName });
    setError(null);
    onClose();
  }, [loading, onClose, sessionName]);

  /**
   * The document-level Escape listener must always call the *current* close
   * handler — including its `loading` guard — without re-attaching itself every
   * time the handler's identity changes (it changes on submit). Routing through
   * a ref keeps the listener attached once per open.
   */
  const closeRef = useRef(handleClose);
  useEffect(() => {
    closeRef.current = handleClose;
  }, [handleClose]);

  // Reset the form whenever the dialog opens, so a cancelled edit never leaks
  // back in as a stale draft.
  useEffect(() => {
    if (isOpen) {
      setFormData({ name: sessionName });
      setError(null);
    }
  }, [isOpen, sessionName]);

  // Focus management, scroll lock, and Escape.
  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      setError('Enter your name to continue.');
      nameInputRef.current?.focus();
      return;
    }

    if (trimmedName.length < 2) {
      setError('Your name needs at least 2 characters.');
      nameInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onProfileUpdate({ name: trimmedName });
      onClose();
    } catch {
      setError('We could not save your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ name: event.target.value });

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  // Keep Tab inside the dialog while it is modal.
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/25 p-4 backdrop-blur-sm dark:bg-background/85"
      // A click that starts and ends on the scrim closes; a drag that starts
      // inside the dialog never does.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleDialogKeyDown}
        className="rise-in max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border-subtle bg-card shadow-overlay"
      >
        {/* Header — title and a quiet dismiss, closed by a hairline */}
        <div className="flex items-start justify-between gap-6 border-b border-border-subtle px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
              Edit profile
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
              This is the name other students see on your reports and claims.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            disabled={loading}
            aria-label="Close dialog"
            className="-mr-2 -mt-1"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-6 py-6">
            {error && (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email address</Label>
              <Input
                id="profile-email"
                type="email"
                value={session?.user?.email ?? ''}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Email is tied to your sign-in and cannot be changed here.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="profile-name">
                Full name <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </Label>
              <Input
                id="profile-name"
                ref={nameInputRef}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. Aarav Sharma"
                autoComplete="name"
                required
                disabled={loading}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
          </div>

          {/* Actions — one primary, one quiet cancel */}
          <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-6 py-4">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!formData.name.trim()}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
