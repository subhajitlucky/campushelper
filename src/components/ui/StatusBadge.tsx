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
  /**
   * The single source of truth for item-status colour.
   *
   * Tokenisation collapsed CLAIMED and RESOLVED onto the same pair (both were a
   * tinted blue after the mechanical migration), which made two different states
   * visually identical. The states are deliberately distinguished here — and
   * only here — so StatusBadge, the admin tables, and the claim panels cannot
   * disagree about what "resolved" looks like:
   *
   *   LOST      amber    — something is missing, it needs attention
   *   FOUND     green    — good news, outlined
   *   CLAIMED   blue     — in progress
   *   RESOLVED  green    — terminal, and *filled* so it reads as finished
   *                        rather than merely found
   *   DELETED   muted    — greyed out, out of play
   */
  const getColorClasses = (status: string) => {
    switch (status) {
      case 'LOST':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'FOUND':
        return 'bg-success/10 text-success border-success/30';
      case 'CLAIMED':
        return 'bg-info/10 text-info border-info/30';
      case 'RESOLVED':
        return 'bg-success text-success-foreground border-success';
      case 'DELETED':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };



  // Use outline variant with custom colors for better control
  return (
    <Badge
      variant="outline"
      className={`
        ${sizeClasses[size]}
        ${getColorClasses(status)}
        ${className}
      `}
    >
      {status}
    </Badge>
  );
}
