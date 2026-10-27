import type { MetadataRoute } from 'next';

import { SITE_URL, SITEMAP_ROUTES } from '@/lib/site';

/**
 * `/sitemap.xml`
 *
 * Only the stable public pages are listed. Item detail pages are deliberately
 * omitted: they are user-generated, can be moderated away, and the sitemap is
 * generated at build time without a database connection.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
