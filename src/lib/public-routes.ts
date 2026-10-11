/**
 * Boundary-aware public route matching for the auth middleware.
 *
 * A route matches only when the pathname is exactly the route or continues
 * with a `/` separator, so `/` does not make every path public and
 * `/search-results` does not match `/search`.
 */

export const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/search',
  '/resolved',
] as const;

export const PUBLIC_API_ROUTES = [
  '/api/csrf-token',
  '/api/auth/session',
  '/api/auth/signin',
  '/api/auth/signout',
] as const;

export function matchesRouteBoundary(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicPageRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => matchesRouteBoundary(pathname, route));
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => matchesRouteBoundary(pathname, route));
}
