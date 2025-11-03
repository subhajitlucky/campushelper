import { Badge } from './badge';

interface StatusBadgeProps {
  status: 'LOST' | 'FOUND' | 'CLAIMED' | 'RESOLVED' | 'DELETED' | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * StatusBadge Component
 *
 * Displays status with consistent color coding across the app.
 * Automatically applies the correct colors for different statuses.
 */
export default function StatusBadge({ status, className = '', size = 'sm' }: StatusBadgeProps) {
  const getVariant = (status: string) => {
    switch (status) {
      case 'LOST':
        return 'destructive';
      case 'FOUND':
        return 'default';
      case 'CLAIMED':
        return 'secondary';
      case 'RESOLVED':
        return 'outline';
      case 'DELETED':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getColorClasses = (status: string) => {
    switch (status) {
      case 'LOST':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'FOUND':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CLAIMED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RESOLVED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DELETED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const badgeVariant = getVariant(status);

  // Use outline variant with custom colors for better control
  return (
    <Badge
      variant={badgeVariant === 'outline' ? 'outline' : badgeVariant}
      className={`
        ${sizeClasses[size]}
        ${badgeVariant === 'outline' ? getColorClasses(status) : ''}
        ${className}
      `}
    >
      {status}
    </Badge>
  );
}
