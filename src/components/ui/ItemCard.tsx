import Link from 'next/link';
import { Card, CardContent, CardHeader } from './card';
import StatusBadge from './StatusBadge';
import UserDisplay from './UserDisplay';
import ItemImage from './ItemImage';
import { Button } from './button';

interface Item {
  id: string;
  title: string;
  description: string;
  itemType: 'LOST' | 'FOUND';
  status: string;
  location: string;
  createdAt: string;
  images?: string[] | null;
  postedBy: {
    name: string | null;
    avatar: string | null;
  };
}

interface ItemCardProps {
  item: Item;
  user?: {
    isLoggedIn: boolean;
    userId?: string;
  };
  showActions?: boolean;
  onFound?: (item: Item) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

/**
 * ItemCard Component
 *
 * Complete item card with image, status, title, description, and actions.
 * Reusable across lost-items, resolved, and search pages.
 */
export default function ItemCard({
  item,
  user,
  showActions = true,
  onFound,
  className = '',
  variant = 'default'
}: ItemCardProps) {
  const isCompact = variant === 'compact';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card
      className={`flex h-full flex-col overflow-hidden border border-gray-200 bg-white transition-shadow ${
        isCompact ? 'hover:shadow-sm' : 'hover:shadow-md'
      } ${className}`}
    >
      {/* Item Image */}
      <ItemImage
        images={item.images}
        alt={item.title}
        aspectRatio={isCompact ? 'square' : 'video'}
        className={isCompact ? 'max-h-48' : ''}
      />

      {/* Card Header */}
      <CardHeader className={`${isCompact ? 'px-4 pt-4 pb-2' : 'px-6 pt-6 pb-3'}`}>
        <div className={`flex items-start justify-between gap-2 ${isCompact ? 'mb-1' : 'mb-2'}`}>
          <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 line-clamp-2`}
          >
            {item.title}
          </h3>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-xs text-gray-500">
          {formatDate(item.createdAt)}
        </p>
      </CardHeader>

      {/* Card Content */}
      <CardContent className={`${isCompact ? 'px-4 pb-4 pt-0' : 'px-6 pb-6 pt-0'} flex flex-col gap-3`}> 
        <p className={`${isCompact ? 'text-sm' : 'text-sm'} text-gray-700 ${isCompact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {item.description}
        </p>

        {/* Item Details */}
        <div className="space-y-2">
          <div className={`${isCompact ? 'text-xs' : 'text-sm'} flex items-center text-gray-500`}> 
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {item.location}
          </div>

          {isCompact ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <UserDisplay user={item.postedBy} size="sm" showLabel={false} />
              <span>{item.postedBy.name || 'Anonymous'}</span>
            </div>
          ) : (
            <UserDisplay user={item.postedBy} size="sm" />
          )}
        </div>

        {/* Actions */}
        {showActions && user && (
          <div className={`mt-auto ${isCompact ? 'pt-2' : 'pt-3'}`}>
            {user.isLoggedIn ? (
              <div className="space-y-2">
                <Button asChild size="sm" variant={isCompact ? 'outline' : 'default'} className="w-full">
                  <Link href={`/item/${item.id}`}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </Link>
                </Button>
                {item.status === 'LOST' && onFound && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => onFound(item)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    I Found This!
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = '/auth/login'}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Login to View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = '/auth/login'}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Post Your Item
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
