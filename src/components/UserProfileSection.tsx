'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Calendar, Mail, Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import ReputationBadge from '@/components/ui/ReputationBadge';
import { useAuthFetch } from '@/lib/auth-fetch';

import EditProfileModal from './EditProfileModal';

interface UserProfileSectionProps {
  /**
   * The user's reputation total, when the caller could determine it.
   *
   * There is no endpoint that returns the signed-in user's own total, so the
   * dashboard reads it off `postedBy.reputation` on the user's own item rows —
   * the same denormalised `User.reputation` column. Callers that cannot
   * determine it omit the badge rather than inventing a number.
   */
  reputation?: number;
}

/** Fields next-auth's session callback does not carry, read defensively. */
type SessionExtras = { avatar?: string; createdAt?: string };

/**
 * ProfileHeader — the dashboard's single `PageHeader`.
 *
 * The old version was a `<Card>` wrapping a bordered "Activity Overview" grid of
 * four tinted boxes plus a grey panel of percentages: five containers, four of
 * them duplicating the same counts the stats strip now shows. What is left is
 * the identity block (avatar, name, email, member since, reputation) with the
 * page's one primary action, and the edit modal it owns.
 *
 * `PageHeader` supplies the type (30/36px, weight 600) and the hairline rule, so
 * this file no longer derives either.
 */
export default function UserProfileSection({ reputation }: UserProfileSectionProps) {
  const { data: session } = useSession();
  const { fetchWithAuth } = useAuthFetch(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!session?.user) {
    return null;
  }

  const { name, email } = session.user;
  const { avatar, createdAt } = session.user as typeof session.user & SessionExtras;

  const displayName = name?.trim() || 'Your dashboard';
  const memberSince = createdAt ? new Date(createdAt) : null;
  const hasMemberSince = memberSince !== null && !Number.isNaN(memberSince.getTime());

  // Handle profile update
  const handleProfileUpdate = async (updatedData: { name: string }) => {
    // A thrown error is surfaced by the modal; the reload below only runs once
    // the API has accepted the change.
    const response = await fetchWithAuth('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updatedData),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    // On success, refresh the page to get updated session data
    window.location.reload();
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-muted-foreground">
              {avatar ? (
                <Image
                  src={avatar}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 object-cover"
                />
              ) : (
                <span aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0 truncate">{displayName}</span>
          </span>
        }
        description="Your reports, the claims you have made, and the claims waiting on your decision."
        meta={
          <>
            {typeof reputation === 'number' && <ReputationBadge total={reputation} showPoints size="md" />}
            {email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{email}</span>
              </span>
            )}
            {hasMemberSince && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4 shrink-0" aria-hidden="true" />
                Member since{' '}
                {memberSince.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit profile
            </Button>
            <Button asChild>
              <Link href="/post">
                <Plus className="size-4" aria-hidden="true" />
                Post an item
              </Link>
            </Button>
          </>
        }
      />

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
}
