import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

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
              "worker-src 'self' blob:", // Allow web workers for image compression
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
