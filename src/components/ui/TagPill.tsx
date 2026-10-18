'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagPillProps {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * TagPill Component
 *
 * Small presentational pill for a single item tag, rendered as `#tag`.
 *
 * Three shapes, all keyboard reachable:
 * - read-only: plain text inside a span
 * - removable: the text plus a real remove button with an accessible name
 * - toggle filter: the text is a button carrying `aria-pressed`
 *
 * The remove button is a sibling of the toggle button, never a child, so the
 * markup stays valid when a pill is both selectable and removable.
 */
export default function TagPill({
  tag,
  onRemove,
  onClick,
  selected = false,
  className
}: TagPillProps) {
  const pillClasses = cn(
    'inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs',
    selected && 'bg-blue-600 text-white',
    onClick && !selected && 'hover:bg-gray-200',
    className
  );

  const label = `#${tag}`;

  return (
    <span className={pillClasses}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          className="rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        >
          {label}
        </button>
      ) : (
        label
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
          className="opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
