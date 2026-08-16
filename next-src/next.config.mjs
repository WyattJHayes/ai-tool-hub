import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: '/tools/resume-optimizer',
        destination: '/resume/',
        permanent: true,
      },
      {
        source: '/tools/resume-optimizer/',
        destination: '/resume/',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is only required by Next.js dev tooling; keep it
              // out of production builds to harden the script surface.
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://browser.sentry-cdn.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // The app talks to DeepSeek server-side only; there is no
              // browser-facing OpenAI call, so that origin stays unlisted.
              "connect-src 'self' https://sentry.io https://*.sentry.io https://*.supabase.co wss://*.supabase.co",
              "frame-src 'none'",
              "object-src 'none'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  hideSourceMaps: true,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
