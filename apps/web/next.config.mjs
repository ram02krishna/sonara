import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getApiDestination = () => {
  const configured = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

  // Rewrites are baked in at build time. On Vercel a missing value would silently
  // proxy every /api/v1 call to localhost and the deployed site would be broken,
  // so fail the build with a clear message instead.
  if (process.env.VERCEL && !configured) {
    console.warn(
      '⚠️ API_INTERNAL_URL is not set. Go to Vercel Project > Settings > Environment Variables and set it ' +
        'to your public API URL (e.g. your Render backend URL).'
    );
  }

  const envUrl = configured || 'http://127.0.0.1:8080/api/v1';
  const cleanUrl = envUrl.replace(/\/+$/, '');
  if (cleanUrl.endsWith('/api/v1')) {
    return `${cleanUrl}/:path*`;
  }
  return `${cleanUrl}/api/v1/:path*`;
};

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Docker image sets NEXT_OUTPUT=standalone to get a small, self-contained server.
  // Vercel and local `next dev/build` leave it unset and use the default output.
  ...(process.env.NEXT_OUTPUT === 'standalone'
    ? {
        output: 'standalone',
        // Monorepo: trace dependencies from the repo root so hoisted node_modules are included.
        experimental: { outputFileTracingRoot: path.join(__dirname, '../../') },
      }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.scdn.co',
      },
      {
        protocol: 'https',
        hostname: '**.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: getApiDestination(),
      },
    ];
  },
};

export default nextConfig;
