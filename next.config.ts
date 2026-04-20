import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Makes `getCloudflareContext()` work in `next dev` so we get D1 bindings locally.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the build lean — no server components bloat.
  experimental: {
    // Nothing fancy; we want lightweight.
  },
};

export default nextConfig;
