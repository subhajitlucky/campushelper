'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function LoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Deferred so state updates do not run synchronously inside the effect
    const showTimer = setTimeout(() => setIsNavigating(true), 0);
    const hideTimer = setTimeout(() => setIsNavigating(false), 300);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [pathname, searchParams]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="flex items-center justify-center py-2">
        <LoadingSpinner size="sm" text="Loading..." />
      </div>
    </div>
  );
}
