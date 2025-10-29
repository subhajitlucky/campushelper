'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * ProtectedRoute Component
 *
 * PURPOSE:
 * - Guards routes that require authentication
 * - Redirects to login if user is not authenticated
 * - Shows loading state while checking authentication
 *
 * USAGE:
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, status } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=' + encodeURIComponent(window.location.pathname));
    }
  }, [isAuthenticated, status, router]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}

/*
HOW IT WORKS:

1. useEffect hook runs when component mounts
   - Checks if user is authenticated
   - If not, redirects to /auth/login with return URL

2. Authentication States:
   - 'loading': Checking if user is logged in
   - 'authenticated': User is logged in, show content
   - 'unauthenticated': User not logged in, show nothing (will redirect)

3. Return URL:
   - We save the current path as callbackUrl
   - After successful login, user returns to original page
   - Example: /auth/login?callbackUrl=/dashboard

WHY NOT MIDDLEWARE?
- Client-side protection: Good for SPA experience
- Can show loading states
- More flexible (can protect specific components)
- Middleware (next step): Server-side protection, faster, more secure

BEST PRACTICE:
Use both! Client-side for good UX, middleware for security.
*/
