import Link from 'next/link';
import { Button } from './button';

interface ActionButton {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  size?: 'sm' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ActionButtonsProps {
  actions: ActionButton[];
  layout?: 'horizontal' | 'vertical';
  className?: string;
  fullWidth?: boolean;
}

/**
 * ActionButtons Component
 *
 * Reusable action buttons container.
 * Supports multiple button configurations with icons and variants.
 */
export default function ActionButtons({
  actions,
  layout = 'horizontal',
  className = '',
  fullWidth = false
}: ActionButtonsProps) {
  const layoutClass = layout === 'vertical' ? 'flex-col' : 'flex-row';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`flex items-center gap-2 ${layoutClass} ${widthClass} ${className}`}>
      {actions.map((action, index) => {
        const ButtonContent = (
          <>
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </>
        );

        if (action.href) {
          return (
            <Button
              key={index}
              variant={action.variant || 'outline'}
              size={action.size || 'sm'}
              asChild
              className={widthClass}
            >
              <Link href={action.href}>
                {ButtonContent}
              </Link>
            </Button>
          );
        }

        return (
          <Button
            key={index}
            variant={action.variant || 'outline'}
            size={action.size || 'sm'}
            onClick={action.onClick}
            disabled={action.disabled}
            className={widthClass}
          >
            {ButtonContent}
          </Button>
        );
      })}
    </div>
  );
}

// Predefined action sets for common patterns
export const ItemActions = {
  viewOnly: (href: string) => [
    {
      label: 'View Details',
      href,
      variant: 'default' as const,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    }
  ],

  viewAndFound: (href: string, onFound: () => void) => [
    {
      label: 'View Details',
      href,
      variant: 'default' as const,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    },
    {
      label: 'I Found This!',
      onClick: onFound,
      variant: 'secondary' as const,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      )
    }
  ],

  viewEditDelete: (href: string, onEdit: () => void, onDelete: () => void, showDelete = true): ActionButton[] => {
    const actions: ActionButton[] = [
      {
        label: 'View',
        href,
        variant: 'outline' as const,
        size: 'sm' as const,
        icon: (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )
      },
      {
        label: 'Edit',
        onClick: onEdit,
        variant: 'outline' as const,
        size: 'sm' as const,
        icon: (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
      }
    ];

    if (showDelete) {
      actions.push({
        label: 'Delete',
        onClick: onDelete,
        variant: 'destructive' as const,
        size: 'sm' as const,
        icon: (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )
      });
    }

    return actions;
  }
};
