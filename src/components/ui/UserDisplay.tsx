import Image from 'next/image';

interface User {
  name: string | null;
  avatar: string | null;
}

interface UserDisplayProps {
  user: User;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelPrefix?: string;
}

/**
 * UserDisplay Component
 *
 * Displays user avatar with name fallback.
 * Handles both avatar image and initials fallback.
 */
export default function UserDisplay({
  user,
  className = '',
  size = 'md',
  showLabel = true,
  labelPrefix = 'Posted by'
}: UserDisplayProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const name = user.name || 'Anonymous';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {user.avatar ? (
        <Image
          src={user.avatar}
          alt={name}
          width={size === 'sm' ? 20 : size === 'md' ? 24 : 32}
          height={size === 'sm' ? 20 : size === 'md' ? 24 : 32}
          className={`rounded-full object-cover ${sizeClasses[size]}`}
        />
      ) : (
        <div className={`${sizeClasses[size]} bg-gray-200 rounded-full flex items-center justify-center`}>
          <span className={`text-gray-500 font-medium ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {showLabel && (
        <span className={`text-gray-600 ${textSizeClasses[size]}`}>
          {labelPrefix} {name}
        </span>
      )}
    </div>
  );
}
