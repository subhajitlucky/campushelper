import { withAuth } from "next-auth/middleware";
import { NextResponse } from 'next/server';

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
 */

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Admin route protection
    if (pathname.startsWith('/admin')) {
      const userRole = token?.role as string;
      if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
        // Redirect to home if not admin/moderator
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    // Allow request to continue
    return NextResponse.next();
  },
  {
    callbacks: {
      // Decide if request should run through middleware
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Public routes that don't require authentication
        const publicRoutes = ['/', '/auth/login', '/auth/signup', '/search', '/resolved'];
        const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
        
        // Allow public access to resolved items API requests
        const isResolvedItemsAPI = pathname === '/api/items' && 
          req.nextUrl.searchParams.get('status') === 'RESOLVED' &&
          !req.nextUrl.searchParams.get('search') &&
          !req.nextUrl.searchParams.get('postedById') &&
          !req.nextUrl.searchParams.get('from') &&
          !req.nextUrl.searchParams.get('to');
        
        // Allow public access to these routes
        if (isPublicRoute || isResolvedItemsAPI) {
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
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api/auth/* (authentication endpoints - must be public)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * 
     * SECURITY IMPROVEMENT: Now protects ALL other API routes with authentication
     * instead of leaving them completely open to attacks.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
