import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/** `/robots.txt` */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Signed-in and write surfaces have nothing to index, and crawling
        // them only produces redirects and 401s.
        disallow: ['/admin', '/dashboard', '/notifications', '/post', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
