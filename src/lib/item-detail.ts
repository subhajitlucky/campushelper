import { prisma } from './prisma';

/**
 * Shared item-detail projection used by both the item API route and the
 * server-rendered item page, so privacy and authorization rules cannot drift.
 */

export interface ItemViewer {
  id?: string;
  role?: string;
}

export interface ItemDetailUser {
  id: string;
  name: string | null;
  email?: string;
  avatar: string | null;
  /** Reputation total, surfaced as a tier badge. */
  reputation?: number;
  /** Granted by a moderator; not an automated student-email check. */
  verifiedStudent?: boolean;
}

export interface ItemDetailClaim {
  id: string;
  claimType: string;
  message: string;
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email?: string;
    avatar: string | null;
  };
}

export interface ItemDetailComment {
  id: string;
  message: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface ItemDetailData {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED';
  location: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  postedBy: ItemDetailUser;
  claimedBy: ItemDetailUser | null;
  claims?: ItemDetailClaim[];
  comments?: ItemDetailComment[];
}

/**
 * Fetch a single item with the same projection and privacy rules as the API.
 * Returns null when the item does not exist or is soft-deleted and the viewer
 * is neither the owner nor an admin/moderator.
 */
export async function getItemDetailForViewer(
  itemId: string,
  viewer: ItemViewer | null
): Promise<ItemDetailData | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      postedById: true,
      claimedById: true,
      status: true,
      itemType: true,
    },
  });

  if (!item) {
    return null;
  }

  const userId = viewer?.id;
  const userRole = viewer?.role;
  const isOwner = userId === item.postedById;
  const isClaimant = userId === item.claimedById;
  const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
  const canSeeUserData = !!(userId && (isOwner || isAdmin || isClaimant));

  if (item.status === 'DELETED' && !isOwner && !isAdmin) {
    return null;
  }

  const itemData = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      title: true,
      description: true,
      itemType: true,
      status: true,
      location: true,
      images: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,

      postedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          reputation: true,
          verifiedStudent: true,
        },
      },
      claimedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          reputation: true,
          verifiedStudent: true,
        },
      },

      ...(userId && (isOwner || isAdmin) && {
        claims: {
          select: {
            id: true,
            claimType: true,
            message: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                ...(isAdmin ? { email: true } : {}),
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' as const },
        },
        comments: {
          select: {
            id: true,
            message: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' as const },
        },
      }),
    },
  });

  if (!itemData) {
    return null;
  }

  // Process name truncation for non-owners
  if (!isOwner && !isAdmin) {
    const name = itemData.postedBy.name || '';
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      itemData.postedBy.name = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
    }
  }

  if (!canSeeUserData) {
    delete (itemData.postedBy as { email?: string }).email;
  }

  if (itemData.claimedBy && !canSeeUserData) {
    delete (itemData.claimedBy as { email?: string }).email;
  }

  return itemData as unknown as ItemDetailData;
}
