import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    /**
     * Outlined by default: an empty state's action is usually an escape hatch
     * ("Clear filters"), which should not compete with the page's primary CTA.
     * Pass "default" when it genuinely is the one thing to do next.
     */
    variant?: 'default' | 'outline';
  };
  className?: string;
}

/**
 * EmptyState Component
 *
 * Displays a consistent empty state with icon, title, description, and optional action.
 * Used when there are no items to display.
 *
 * Deliberately containerless: an empty state is a message plus a way out, not a
 * bordered box. The page (or the results region) provides the surrounding space.
 *
 * The icon slot is size-normalised to 48px with `[&_svg]`, so the pre-defined
 * `EmptyStateIcons` below stay 48px even though they carry their own `w-16`.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`mx-auto max-w-md py-16 text-center ${className}`}>
      {icon && (
        <div className="mb-5 flex justify-center text-muted-foreground/70 [&_svg]:size-12">
          {icon}
        </div>
      )}

      <h3 className="text-base font-medium text-foreground">{title}</h3>

      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}

      {action && (
        <div className="mt-6 flex justify-center">
          <Button variant={action.variant ?? 'outline'} onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

// Pre-defined icons for common empty states
export const EmptyStateIcons = {
  items: (
    <svg className="size-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  search: (
    <svg className="size-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  claims: (
    <svg className="size-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.34 0-4.5-.785-6.172-2.172M12 3c3.314 0 6 2.686 6 6 0 1.86-.792 3.542-2.073 4.828" />
    </svg>
  ),
  default: (
    <svg className="size-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.34 0-4.5-.785-6.172-2.172M12 3c3.314 0 6 2.686 6 6 0 1.86-.792 3.542-2.073 4.828" />
    </svg>
  )
};
