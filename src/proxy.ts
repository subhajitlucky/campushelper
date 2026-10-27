import { withAuth } from "next-auth/middleware";
import { NextResponse } from 'next/server';
import {
  isPublicPageRoute,
  isPublicApiRoute,
  isPublicReadApiRoute,
  isProtectedPageRoute,
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

    // API routes are default-deny. `withAuth` can only redirect when its
    // `authorized` callback says no, so protected APIs are let through to this
    // point and answered with a 401 here instead of a 307 to an HTML page.
    if (
      matchesRouteBoundary(pathname, '/api') &&
      !token &&
      !isPublicApiRoute(pathname) &&
      !isPublicReadApiRoute(pathname, req.method)
    ) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

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
    // `withAuth` keeps its own copy of this option and does not read the
    // NextAuth config in src/lib/auth.ts, so both must name the branded page.
    pages: {
      signIn: '/auth/login',
    },
    callbacks: {
      // Decide if request should run through middleware
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes that don't require authentication
        const isPublicRoute = isPublicPageRoute(pathname);

        // Public API routes that don't require authentication
        const isPublicAPIRoute = isPublicApiRoute(pathname);

        // Public reads (item list/detail, categories, zones). The route
        // handlers apply the anonymous visibility rules and keep mutations
        // protected.
        const isPublicReadAPIRoute = isPublicReadApiRoute(pathname, req.method);

        // Allow public access to these routes
        if (isPublicRoute || isPublicAPIRoute || isPublicReadAPIRoute) {
          return true;
        }

        // API routes are default-deny: a new endpoint is protected unless it is
        // explicitly opened above. Return true so the middleware body can
        // answer with a 401 rather than `withAuth`'s sign-in redirect.
        if (matchesRouteBoundary(pathname, '/api')) {
          return true;
        }

        // Known protected pages require a session.
        if (isProtectedPageRoute(pathname)) {
          return !!token;
        }

        // Everything else is an unknown page. Let the App Router render its
        // 404 instead of redirecting a mistyped public URL to sign-in.
        return true;
      },
    },
  }
);

/**
 * Which routes the middleware runs on.
 *
 * **The string below must stay a literal.** Next.js reads this field by static
 * analysis at build time and rejects anything it cannot evaluate:
 *
 *   Error: Next.js can't recognize the exported `config` field in route.
 *   Entry `matcher[0]` need to be static strings or static objects.
 *
 * That failure is loud in dev but was *invisible* to `typecheck`, `lint` and
 * `test` — so an earlier attempt to share this pattern with the tests as a
 * `MIDDLEWARE_MATCHER` constant shipped a broken proxy past a green suite. The
 * pattern is therefore duplicated here on purpose, and
 * `tests/unit/public-routes.test.ts` reads this file as text to assert the
 * literal still matches `STATIC_ASSET_EXTENSIONS` and still behaves correctly.
 *
 * It matches everything EXCEPT:
 * - api/auth/* (authentication endpoints - must be public)
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico, and anything else ending in a static-asset extension — i.e.
 *   the public/ folder.
 *
 * The original pattern excluded the literal path segment `public`, which is not
 * how the public folder is served: a file at public/logo.png is requested as
 * /logo.png, so every asset in it fell through to `withAuth` and answered a
 * signed-out visitor with a 307 to the sign-in page. Verified against
 * production before the fix: GET /next.svg returned 307, not 200. It went
 * unnoticed only because public/ held five unused starter SVGs, and it would
 * have broken the first real asset added.
 *
 * The exclusion is anchored on the extension rather than on a path prefix, so
 * it cannot open up an application route that merely contains a dot.
 *
 * SECURITY IMPROVEMENT: Now protects ALL other API routes with authentication
 * instead of leaving them completely open to attacks.
 */
export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|webmanifest|woff|woff2|ttf|otf|eot|mp4|webm|pdf)$).*)',
  ],
};
