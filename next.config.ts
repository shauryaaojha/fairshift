import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (`npm start` and Vercel use the default).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  cacheComponents: true,
  partialPrefetching: true,

  // Security headers and CSP. Why script-src keeps 'unsafe-inline': see SECURITY.md.
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '0',
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'off',
        },
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
        {
          key: 'Cross-Origin-Resource-Policy',
          value: 'same-origin',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(self), geolocation=(self), payment=()',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // unsafe-eval is only needed by the dev server (React refresh), never in production.
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "worker-src 'self'",
            "manifest-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    },
  ],
};

export default nextConfig;
