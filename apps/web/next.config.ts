import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
  // Development access over Tailscale Serve (HTTPS). Production is unaffected.
  allowedDevOrigins: ['vmi3311790.taila50457.ts.net'],
  // The dev badge sits on top of the landing footer; not needed while demoing.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
