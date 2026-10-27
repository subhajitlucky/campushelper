/**
 * Canonical site origin for metadata routes and absolute URLs.
 *
 * `NEXT_PUBLIC_BASE_URL` is set in production; the fallback keeps local builds
 * and previews from emitting relative or `localhost` URLs in the sitemap.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL || 'https://campushelper.vercel.app'
).replace(/\/+$/, '');

/** Public pages that are useful to a search engine. */
export const SITEMAP_ROUTES = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/lost-items', changeFrequency: 'daily', priority: 0.9 },
  { path: '/resolved', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/search', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/map', changeFrequency: 'weekly', priority: 0.6 },
] as const;
