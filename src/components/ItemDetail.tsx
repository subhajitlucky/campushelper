/**
 * ItemDetail — the /item/[id] page body.
 *
 * Layout follows the redesign brief §4.1: the photo leads at 4:3, the
 * description is plain body copy, and the owner, the spec list and the actions
 * live in a rail that sticks on desktop (lg) and folds under the content on
 * mobile. Sections are grouped by whitespace and hairline rules; the only boxes
 * left are the ones that are genuinely objects.
 *
 * Everything behavioural is unchanged from the previous implementation: the
 * inline edit form and its save/cancel handlers, the double-confirm delete, the
 * claim modal, and every permission branch (canEdit / isOwner / isAdmin /
 * isResolved / DELETED).
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  Backpack,
  BookOpen,
  CheckCircle2,
  Clock,
  Dumbbell,
  FileText,
  IdCard,
  ImageOff,
  KeyRound,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Search,
  Shirt,
  Smartphone,
  Trash2,
  TriangleAlert,
  Watch,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/ui/PageHeader';
import SectionHeader from '@/components/ui/SectionHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import TagPill from '@/components/ui/TagPill';
import { Textarea } from '@/components/ui/textarea';
import { formatRelativeTime } from '@/lib/notification-display';
import { cn } from '@/lib/utils';

import CommentsSection from './CommentsSection';
import ClaimsModal from './ClaimsModal';
import PossibleMatches from './PossibleMatches';
import ReputationBadge from './ui/ReputationBadge';
import VerifiedStudentBadge from './ui/VerifiedStudentBadge';
import { useAuthFetch } from '@/lib/auth-fetch';

interface ItemUser {
  id: string;
  name: string | null;
  email?: string;
  avatar: string | null;
  /** Reputation total, from the item-detail projection. */
  reputation?: number;
  /** Granted by a moderator, not an automated email check. */
  verifiedStudent?: boolean;
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
  location: string;
  images: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
  resolvedAt: string | Date | null;
  postedBy: ItemUser;
  claimedBy?: ItemUser | null;
  /** Present on projections that count claims; otherwise `claims` is used. */
  claimCount?: number;
  /**
   * Classification fields. The shared item-detail projection does not select
   * them yet, so they are optional and every consumer below degrades to
   * something honest rather than inventing a value.
   */
  category?: { slug: string; name: string; icon: string } | null;
  zone?: { slug: string; name: string } | null;
  tags?: string[] | null;
  /** Present only for the poster and moderators; used for the claim count. */
  claims?: { id: string }[] | null;
}

interface ItemDetailProps {
  item: ItemData;
}

/**
 * Category taxonomy → icon. Mirrors the seeded lucide icon names
 * (`prisma/migrations/…_seed_categories_zones`) and is intentionally a local
 * copy: ItemCard keeps the same map but does not export it, and pulling the
 * whole icon set in through a dynamic lookup would ship every lucide icon.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Smartphone,
  IdCard,
  FileText,
  BookOpen,
  KeyRound,
  Backpack,
  Shirt,
  Watch,
  Dumbbell,
  Package,
};

/**
 * The file's single `<img>`. Item photos and avatars both render through it, so
 * there is exactly one place to move to next/image later.
 *
 * next/image is deliberately not used here: item photos can live on hosts that
 * are not in `images.remotePatterns`, where next/image throws and takes the page
 * to the error boundary instead of degrading to the placeholder.
 */
function RemoteImage({
  src,
  alt,
  className,
  onError,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={onError}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
}

/** Relative date plus the absolute date it falls back to on hover. */
function dateLabels(value: string | Date | null): { relative: string; absolute: string } {
  if (!value) return { relative: '', absolute: '' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { relative: '', absolute: '' };

  return {
    relative: formatRelativeTime(date.toISOString()),
    absolute: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  };
}

function humanType(itemType: 'LOST' | 'FOUND'): string {
  return itemType === 'LOST' ? 'Lost item' : 'Found item';
}

/** One label/value row of the spec list. */
function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Avatar with an initials fallback, so a blocked or dead URL never leaves a hole. */
function Avatar({ user, className }: { user: ItemUser | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'U';
  const showImage = Boolean(user?.avatar) && !failed;

  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground',
        className
      )}
      aria-hidden="true"
    >
      {showImage ? (
        <RemoteImage
          src={user?.avatar as string}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

/** A person in the rail: label, avatar, name, contact line, trust badges. */
function PersonRow({
  label,
  user,
}: {
  label: string;
  user: ItemUser | null | undefined;
}) {
  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>

      <div className="mt-3 flex items-start gap-3">
        <Avatar user={user} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-foreground">
            {user?.name || 'Anonymous user'}
          </p>

          {user?.email && (
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          )}

          {(typeof user?.reputation === 'number' || user?.verifiedStudent) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {typeof user?.reputation === 'number' && (
                <ReputationBadge total={user.reputation} />
              )}
              {user?.verifiedStudent && <VerifiedStudentBadge />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ItemDetail({ item }: ItemDetailProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { fetchWithAuth } = useAuthFetch(true);
  const [isClaimsModalOpen, setIsClaimsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemStatus, setItemStatus] = useState(item.status);

  // Fix: Add proper error/success state management
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: item.title,
    description: item.description,
    location: item.location,
    itemType: item.itemType
  });
  const [isSaving, setIsSaving] = useState(false);

  // Gallery state: which photo leads, and which URLs failed to load.
  const [activeImage, setActiveImage] = useState(0);
  const [brokenImages, setBrokenImages] = useState<number[]>([]);

  // Step 112: Check permissions
  const isOwner = session?.user?.id === item.postedBy.id;
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR';
  const canEdit = (isOwner || isAdmin) && itemStatus !== 'RESOLVED'; // Can't edit resolved items
  const isLoggedIn = !!session?.user;
  const isResolved = itemStatus === 'RESOLVED'; // Check if item is resolved

  // Check URL parameter to auto-enter edit mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('edit') === 'true' && canEdit) {
        setIsEditMode(true);
        // Remove the edit parameter from URL for cleaner UI
        window.history.replaceState({}, '', `/item/${item.id}`);
      }
    }
  }, [canEdit, item.id]);

  // Step 112: Handle edit - redirect to post page with pre-filled data
  const handleEdit = () => {
    setIsEditMode(true);
    setError(null);
    setSuccess(null);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithAuth(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update item');
      }

      setSuccess('Item updated successfully!');
      setIsEditMode(false);

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditForm({
      title: item.title,
      description: item.description,
      location: item.location,
      itemType: item.itemType
    });
    setError(null);
    setSuccess(null);
  };

  // Step 112: Handle delete with confirmation
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently remove the item from public view. Continue?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithAuth(`/api/items/${item.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Update local state to reflect deletion
      setItemStatus('DELETED');
      setSuccess('Item has been deleted successfully. Redirecting...');

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch {
      setError('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const images = (item.images ?? []).filter(Boolean);
  const heroImage = images[activeImage];
  const heroIsBroken = brokenImages.includes(activeImage);
  const showHeroImage = Boolean(heroImage) && !heroIsBroken;

  const CategoryIcon: LucideIcon =
    (item.category?.icon && CATEGORY_ICONS[item.category.icon]) ||
    (item.itemType === 'LOST' ? Search : PackageCheck);

  const categoryName = item.category?.name ?? null;
  const zoneName = item.zone?.name ?? null;
  const tags = (item.tags ?? []).filter(Boolean);
  const place = zoneName ?? item.location;

  // Only shown when the projection actually carries a number — an invented "0"
  // would be worse than the missing row.
  const claimCount =
    typeof item.claimCount === 'number' ? item.claimCount : item.claims?.length ?? null;

  const posted = dateLabels(item.createdAt);
  const resolvedAt = dateLabels(item.resolvedAt);

  const markBroken = (index: number) =>
    setBrokenImages((previous) =>
      previous.includes(index) ? previous : [...previous, index]
    );

  const signInHref = '/auth/login';

  // The action branches, written once so the section can also tell whether it
  // has anything to show at all (a labelled region with no content is noise).
  const canAct = itemStatus !== 'DELETED' && !isEditMode && !isResolved;
  const showEditActions = canEdit && canAct;
  const showClaimAction = isLoggedIn && !isOwner && canAct;
  const showSignInToClaim = !isLoggedIn && canAct;
  const showOwnerNote = isLoggedIn && isOwner && itemStatus !== 'DELETED' && !canEdit;
  const hasActions =
    showEditActions || showClaimAction || showSignInToClaim || showOwnerNote || Boolean(error) || Boolean(success);

  return (
    <main className="page-canvas">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Back — kept as history.back() rather than a fixed link, which is what
            this page has always done. */}
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>

        <PageHeader
          title={item.title}
          meta={
            <>
              {/* Status appears once: the type is only repeated as text when the
                  status no longer carries it (claimed / resolved / deleted). */}
              <StatusBadge status={itemStatus} size="md" />

              {itemStatus !== item.itemType && (
                <span className="inline-flex items-center gap-1.5">
                  <CategoryIcon className="size-4" aria-hidden="true" />
                  {humanType(item.itemType)}
                </span>
              )}

              {place && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {place}
                </span>
              )}

              {posted.relative && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" />
                  <span title={posted.absolute}>{posted.relative}</span>
                </span>
              )}

              {resolvedAt.relative && (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  <span title={resolvedAt.absolute}>Resolved {resolvedAt.relative}</span>
                </span>
              )}
            </>
          }
        />

        {/* Show message if item is deleted */}
        {itemStatus === 'DELETED' && (
          <div
            role="status"
            className="mt-8 flex items-start gap-3 rounded-r-lg border-l-2 border-destructive bg-destructive/5 px-4 py-3"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-base font-medium text-destructive">This item was deleted</p>
              <p className="mt-0.5 text-base leading-relaxed text-muted-foreground">
                It is no longer visible in search or on the map.
              </p>
              {canEdit && (
                <p className="mt-0.5 text-base leading-relaxed text-muted-foreground">
                  Only you and moderators can still see it.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-x-12 gap-y-12 lg:grid-cols-3">
          {/* ---------------------------------------------------------------
              Lead: the photo, then either the description or the edit form.
             --------------------------------------------------------------- */}
          <div className="rise-in space-y-8 lg:col-start-1 lg:row-start-1">
            <div className="overflow-hidden rounded-xl bg-muted">
              {showHeroImage && heroImage ? (
                <RemoteImage
                  priority
                  src={heroImage}
                  alt={`${item.title} — photo ${activeImage + 1} of ${images.length}`}
                  className="aspect-[4/3] w-full object-cover"
                  onError={() => markBroken(activeImage)}
                />
              ) : (
                /* No photo (or the URL is dead): a neutral tile with the category
                   icon, never an empty gap. */
                <div
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 text-muted-foreground"
                  role="img"
                  aria-label={`No photo available for ${item.title}`}
                >
                  <CategoryIcon className="size-14" strokeWidth={1.25} aria-hidden="true" />
                  <p className="text-sm">{categoryName ?? humanType(item.itemType)}</p>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <ul className="flex gap-3 overflow-x-auto pb-1">
                {images.map((image, index) => {
                  const isActive = index === activeImage;
                  const isBroken = brokenImages.includes(index);

                  return (
                    <li key={`${image}-${index}`} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveImage(index)}
                        disabled={isBroken}
                        aria-label={`Show photo ${index + 1} of ${images.length}`}
                        aria-current={isActive ? 'true' : undefined}
                        className={cn(
                          'block size-20 overflow-hidden rounded-lg border bg-muted transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          isActive
                            ? 'border-primary'
                            : 'border-border-subtle hover:border-border-strong',
                          isBroken && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        {isBroken ? (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <ImageOff className="size-5" aria-hidden="true" />
                          </span>
                        ) : (
                          <RemoteImage src={image} alt="" className="size-full object-cover" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {isEditMode ? (
              /* EDIT MODE — a form, not a box inside a box. */
              <form
                className="space-y-6"
                aria-labelledby="edit-heading"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveEdit();
                }}
              >
                <SectionHeader
                  id="edit-heading"
                  title="Edit item details"
                  description="Changes are visible to everyone as soon as you save."
                  divider={false}
                />

                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Item title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={5}
                    className="resize-none"
                    placeholder="Item description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="Where was it lost or found?"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium text-foreground">Item type</legend>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-foreground/85">
                      <input
                        type="radio"
                        name="itemType"
                        value="LOST"
                        checked={editForm.itemType === 'LOST'}
                        onChange={(e) => setEditForm({ ...editForm, itemType: e.target.value as 'LOST' | 'FOUND' })}
                        className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                      Lost
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground/85">
                      <input
                        type="radio"
                        name="itemType"
                        value="FOUND"
                        checked={editForm.itemType === 'FOUND'}
                        onChange={(e) => setEditForm({ ...editForm, itemType: e.target.value as 'LOST' | 'FOUND' })}
                        className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                      Found
                    </label>
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-6">
                  <Button
                    type="submit"
                    disabled={isSaving || !editForm.title || !editForm.description || !editForm.location}
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              item.description && (
                <p className="max-w-[65ch] whitespace-pre-wrap text-base leading-relaxed text-foreground/85">
                  {item.description}
                </p>
              )
            )}
          </div>

          {/* ---------------------------------------------------------------
              Right rail: owner, specs, actions. Sticky on desktop, second in
              the flow on mobile so the primary action stays reachable.
             --------------------------------------------------------------- */}
          <aside
            className="rise-in rise-in-delay-1 space-y-10 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start"
            aria-label="Item details and actions"
          >
            {isResolved && item.claimedBy ? (
              /* RESOLVED: the posted → claimed handover, without the boxes. */
              <section className="space-y-5" aria-label="Resolution details">
                <PersonRow label="Posted by" user={item.postedBy} />

                <div className="flex items-center gap-2 border-l border-border-subtle pl-3 text-sm text-success">
                  <ArrowDown className="size-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">Returned</span>
                  {resolvedAt.absolute && (
                    <span className="text-muted-foreground" title={resolvedAt.absolute}>
                      {resolvedAt.relative}
                    </span>
                  )}
                </div>

                <PersonRow label="Claimed by" user={item.claimedBy} />
              </section>
            ) : (
              <PersonRow label="Posted by" user={item.postedBy} />
            )}

            <section aria-labelledby="details-heading">
              <h2
                id="details-heading"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Details
              </h2>

              <dl className="mt-2 divide-y divide-border-subtle text-sm">
                <SpecRow label="Location" value={item.location || 'Not specified'} />
                {categoryName && <SpecRow label="Category" value={categoryName} />}
                {zoneName && <SpecRow label="Zone" value={zoneName} />}

                {tags.length > 0 && (
                  <SpecRow
                    label="Tags"
                    value={
                      <ul className="flex flex-wrap justify-end gap-1.5">
                        {tags.map((tag) => (
                          <li key={tag}>
                            <TagPill tag={tag} />
                          </li>
                        ))}
                      </ul>
                    }
                  />
                )}

                {posted.relative && (
                  <SpecRow
                    label="Posted"
                    value={<span title={posted.absolute}>{posted.relative}</span>}
                  />
                )}

                {claimCount !== null && (
                  <SpecRow label="Claims" value={claimCount} />
                )}
              </dl>
            </section>

            {/* Step 111 & 112: Actions */}
            {hasActions && (
              <section className="space-y-2" aria-label="Actions">
              {/* Fix: Add error/success message display */}
              {error && (
                <div
                  role="alert"
                  className="rounded-r-lg border-l-2 border-destructive bg-destructive/5 px-3 py-2"
                >
                  <p className="text-base text-destructive">{error}</p>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="rounded-r-lg border-l-2 border-success bg-success/5 px-3 py-2"
                >
                  <p className="text-base text-success">{success}</p>
                </div>
              )}

              {/* Step 112: Edit/Delete — the poster or a moderator, never on a
                  resolved item. Primary filled, delete ghost + destructive. */}
              {canEdit && itemStatus !== 'DELETED' && !isEditMode && !isResolved && (
                <>
                  <Button onClick={handleEdit} className="w-full">
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit item
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {isDeleting ? 'Deleting…' : 'Delete item'}
                  </Button>
                </>
              )}

              {/* Step 111: Claim — any signed-in non-owner, on an open item. */}
              {isLoggedIn && !isOwner && itemStatus !== 'DELETED' && !isEditMode && !isResolved && (
                <Button onClick={() => setIsClaimsModalOpen(true)} className="w-full">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Claim this item
                </Button>
              )}

              {!isLoggedIn && itemStatus !== 'DELETED' && !isEditMode && !isResolved && (
                <Button asChild className="w-full">
                  <Link href={signInHref}>
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Sign in to claim
                  </Link>
                </Button>
              )}

              {isLoggedIn && isOwner && itemStatus !== 'DELETED' && !canEdit && (
                <p className="flex items-center gap-2 pt-2 text-base text-muted-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                  This is your posted item.
                </p>
              )}
            </section>
            )}
          </aside>

          {/* ---------------------------------------------------------------
              Discussion: suggestions, then comments. No wrapper container.
             --------------------------------------------------------------- */}
          <div className="rise-in rise-in-delay-2 space-y-12 lg:col-start-1 lg:row-start-2">
            {/* Possible matches - only the poster can act on these */}
            {isOwner && itemStatus !== 'DELETED' && (
              <PossibleMatches itemId={item.id} />
            )}

            {/* Step 109: Comments Section - Hide if item is deleted or user is not logged in */}
            {itemStatus !== 'DELETED' && isLoggedIn && (
              <CommentsSection itemId={item.id} itemStatus={itemStatus} />
            )}

            {/* Show message for non-logged-in users */}
            {!isLoggedIn && itemStatus !== 'DELETED' && (
              <section aria-labelledby="comments-heading">
                <SectionHeader
                  id="comments-heading"
                  title="Comments"
                  description="Sign in to read the discussion and reply."
                />
                <Button asChild className="mt-6">
                  <Link href={signInHref}>Sign in</Link>
                </Button>
              </section>
            )}
          </div>
        </div>

        {/* Step 111: Claims Modal */}
        <ClaimsModal
          isOpen={isClaimsModalOpen}
          onClose={() => setIsClaimsModalOpen(false)}
          itemId={item.id}
          itemTitle={item.title}
          isOwner={isOwner}
        />
      </div>
    </main>
  );
}
