import type { NextConfig } from "next";

type RemotePatternConfig = {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_STORAGE_HOST
  || 'http://localhost:3000';

const supabaseRemotePattern: RemotePatternConfig | null = (() => {
  try {
    const parsed = new URL(supabaseUrl);
    const protocol = parsed.protocol.replace(':', '') as 'http' | 'https';
    const pattern: RemotePatternConfig = {
      protocol,
      hostname: parsed.hostname,
      pathname: '/storage/v1/object/public/**',
    };

    if (parsed.port) {
      pattern.port = parsed.port;
    }

    return pattern;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  /* config options here */

  // Image Optimization Configuration
  images: {
    remotePatterns: [
      // Supabase Storage - for uploaded item images
      ...(supabaseRemotePattern ? [supabaseRemotePattern] : []),
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google avatars - for OAuth users
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },

  // Security Headers for XSS Protection
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs 'unsafe-inline' for dynamic features
              "style-src 'self' 'unsafe-inline'", // Tailwind CSS needs 'unsafe-inline'
              "img-src 'self' data: https: http:", // Allow images from self, data URLs, and external sources
              "font-src 'self' data:", // Allow fonts from self and data URLs
              "connect-src 'self' https: http:", // Allow API calls to self and external sources
              "frame-ancestors 'none'", // Prevent clickjacking attacks
              "base-uri 'self'", // Restrict base URI to same origin
              "form-action 'self'", // Restrict form submissions to same origin
            ].join('; ')
          },
        ],
      },
    ];
  },
};

export default nextConfig;
