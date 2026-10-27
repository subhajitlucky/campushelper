import type { MetadataRoute } from 'next';

/**
 * `/manifest.webmanifest`
 *
 * Kept deliberately minimal: the app is installable as a bookmark-style
 * shortcut, but there is no bespoke icon set to advertise yet.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CampusHelper',
    short_name: 'CampusHelper',
    description: 'Report, search, and recover lost items across campus.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9f7',
    theme_color: '#4f46e5',
  };
}
