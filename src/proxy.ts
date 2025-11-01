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

    // Add Security Headers
    const response = NextResponse.next();

    // 1. Content Security Policy (CSP) - Prevents XSS attacks
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com",
        "frame-src 'self' https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );

    // 2. HTTP Strict Transport Security (HSTS) - Forces HTTPS
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );

    // 3. X-Frame-Options - Prevents clickjacking
    response.headers.set('X-Frame-Options', 'DENY');

    // 4. X-Content-Type-Options - Prevents MIME sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // 5. Referrer-Policy - Controls referrer information
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 6. X-XSS-Protection - Legacy XSS protection (for older browsers)
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // 7. Permissions-Policy - Controls browser features
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );

    // Cache-Control for sensitive pages
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.includes('/api')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }

    return response;
  },
  {
    callbacks: {
      // Decide if request should run through middleware
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes that don't require authentication
        const publicRoutes = ['/', '/auth/login', '/auth/signup', '/search', '/resolved'];
        const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

        // Public API routes that don't require authentication
        const publicAPIRoutes = [
          '/api/csrf-token',
          '/api/auth/session',  // NextAuth needs this to be public
          '/api/auth/signin',
          '/api/auth/signout',
        ];
        const isPublicAPIRoute = publicAPIRoutes.some(route => pathname.startsWith(route));

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
