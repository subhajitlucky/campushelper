import { withAuth } from "next-auth/middleware";
import { NextResponse } from 'next/server';
import {
  MIDDLEWARE_MATCHER,
  isPublicPageRoute,
  isPublicApiRoute,
  matchesRouteBoundary,
} from '@/lib/public-routes';

/**
 * Middleware for Authentication & Authorization
 * 
 * PURPOSE:
 * - Server-side route protection
 * - Runs before page loads (faster than client-side)
 * - More secure - blocks unauthorized requests at edge
 * 
 * WHAT IT DOES:
 * - Checks authentication token for protected routes
 * - Redirects to login if not authenticated
 * - Allows public access to homepage and auth pages
 *
 * Security headers (including the single Content-Security-Policy) are defined
 * in next.config.ts so there is exactly one source of truth.
 */

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Admin route protection
    if (matchesRouteBoundary(pathname, '/admin')) {
      const userRole = token?.role as string;
      if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
        // Redirect to home if not admin/moderator
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Decide if request should run through middleware
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes that don't require authentication
        const isPublicRoute = isPublicPageRoute(pathname);

        // Public API routes that don't require authentication
        const isPublicAPIRoute = isPublicApiRoute(pathname);

        // Allow public access to resolved items API requests
        const isResolvedItemsAPI = pathname === '/api/items' &&
          req.nextUrl.searchParams.get('status') === 'RESOLVED' &&
          !req.nextUrl.searchParams.get('search') &&
          !req.nextUrl.searchParams.get('postedById') &&
          !req.nextUrl.searchParams.get('from') &&
          !req.nextUrl.searchParams.get('to');

        // Allow public access to these routes
        if (isPublicRoute || isPublicAPIRoute || isResolvedItemsAPI) {
          return true;
        }

        // For all other routes, require authentication
        // Return true if token exists (user is authenticated)
        return !!token;
      },
    },
  }
);

// Configure which routes to run middleware on
export const config = {
  matcher: [MIDDLEWARE_MATCHER],
};
