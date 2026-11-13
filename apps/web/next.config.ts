import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@urbanmag/core'],
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ['dev-u.perricheno.com', 'staff-dev-u.perricheno.com'],
  // The optional HMR debug stream stalls hydration through the tunnel proxy.
  experimental: { cpus: 1, optimizePackageImports: ['@phosphor-icons/react'], reactDebugChannel: false },
  serverExternalPackages: ['@electric-sql/pglite', '@node-rs/argon2', 'postgres'],
  images: { formats: ['image/avif', 'image/webp'], minimumCacheTTL: 3600 },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Accel-Buffering', value: 'no' },
    ] }];
  },
};
export default config;
