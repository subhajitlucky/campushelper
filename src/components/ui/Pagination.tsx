import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from './button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  className?: string;
}

/**
 * Pagination Component
 *
 * Centred, on the page background, with the current page as a filled chip and
 * everything else quiet. It used to be a `bg-card rounded-lg shadow p-6` box —
 * a bordered container whose only content was pagination, which is exactly the
 * anti-pattern the redesign removes.
 *
 * Props are unchanged. The count line is centred underneath rather than
 * competing with the controls on the same row.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  total,
  className = ''
}: PaginationProps) {
  // Don't render if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageChip =
    'inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium tabular-nums';

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col items-center gap-3', className)}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        {/* First page */}
        {currentPage > 3 && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="tabular-nums"
              onClick={() => onPageChange(1)}
            >
              1
            </Button>
            {currentPage > 4 && (
              <span className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                …
              </span>
            )}
          </>
        )}

        {/* Current page and neighbours */}
        {getPageNumbers().map((pageNum) =>
          pageNum === currentPage ? (
            <span
              key={pageNum}
              aria-current="page"
              className={cn(pageChip, 'bg-primary text-primary-foreground')}
            >
              {pageNum}
            </span>
          ) : (
            <Button
              key={pageNum}
              variant="ghost"
              size="icon-sm"
              className="tabular-nums"
              onClick={() => onPageChange(pageNum)}
              aria-label={`Page ${pageNum}`}
            >
              {pageNum}
            </Button>
          )
        )}

        {/* Last page */}
        {currentPage < totalPages - 2 && totalPages > 5 && (
          <>
            {currentPage < totalPages - 3 && (
              <span className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                …
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="tabular-nums"
              onClick={() => onPageChange(totalPages)}
              aria-label={`Page ${totalPages}`}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {typeof total === 'number' && (
        <p className="text-sm text-muted-foreground">
          Page <span className="font-medium tabular-nums text-foreground">{currentPage}</span> of{' '}
          <span className="tabular-nums">{totalPages}</span>
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{total}</span> items
        </p>
      )}
    </nav>
  );
}
