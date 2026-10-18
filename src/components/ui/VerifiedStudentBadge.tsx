'use client';

import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Verified student" badge.
 *
 * This means a moderator confirmed the person's student status — it is not an
 * automated student-email check, and the tooltip says so rather than implying a
 * stronger guarantee than the system actually provides.
 */
export default function VerifiedStudentBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800',
        className
      )}
      title="Student status confirmed by a moderator"
    >
      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
      Verified student
    </span>
  );
}
