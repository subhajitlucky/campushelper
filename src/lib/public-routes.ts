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
  '/lost-items',
  '/search',
  '/resolved',
  // Individual reports are public. The page and the item-detail projection
  // already apply the anonymous visibility rules (deleted items 404, poster
  // names truncated, emails withheld); the middleware just has to let guests
  // reach them. Guests still have to sign in to claim, comment or edit.
  '/item',
] as const;

export const PUBLIC_API_ROUTES = [
  '/api/csrf-token',
  '/api/auth/session',
  '/api/auth/signin',
  '/api/auth/signout',
] as const;

/**
 * Read-only API endpoints that are public.
 *
 * The list and detail handlers already take an *optional* session and apply
 * the anonymous visibility rules themselves. Mutations on the same paths stay
 * behind the middleware: only GET/HEAD is opened here, and the handlers
 * additionally require a session, CSRF and ownership for writes.
 *
 * `/api/items/<id>/matches` is deliberately excluded — match suggestions are
 * derived from the full description and are owner/moderator-only.
 */
const PUBLIC_READ_API_PATTERNS = [
  /^\/api\/items(?:\/[^/]+)?$/,
  /^\/api\/categories$/,
] as const;

export function isPublicReadApiRoute(pathname: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    return false;
  }

  return PUBLIC_READ_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function matchesRouteBoundary(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicPageRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => matchesRouteBoundary(pathname, route));
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => matchesRouteBoundary(pathname, route));
}

/**
 * File extensions that identify a request as a static asset rather than an
 * application route. Deliberately excludes `json`, `xml` and `txt`: those are
 * plausible API suffixes, and the point of this list is to be narrow enough
 * that it cannot accidentally make an application route public.
 */
export const STATIC_ASSET_EXTENSIONS = [
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp',
  'webmanifest', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp4', 'webm', 'pdf',
] as const;

/**
 * Should the auth middleware skip this pathname entirely?
 *
 * This is the rule behind the middleware matcher's negative lookahead.
 *
 * The matcher previously excluded the literal path segment `public`, on the
 * assumption that the public folder is served under that prefix. It is not: a
 * file at `public/logo.png` is requested as `/logo.png`, so **every** file in
 * `public/` fell through to `withAuth` and answered a signed-out visitor with a
 * 307 to the sign-in page. Verified against production before the fix — `GET
 * /next.svg` returned 307. It went unnoticed only because `public/` held five
 * unused starter SVGs, and it would have broken the first real asset added
 * (favicon, OG image, logo).
 *
 * The match is anchored on the extension rather than a path prefix, so it
 * cannot open up an application route that merely contains a dot.
 */
export function isStaticAssetPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return STATIC_ASSET_EXTENSIONS.some((extension) => lower.endsWith(`.${extension}`));
}
