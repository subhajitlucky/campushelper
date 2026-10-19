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
