import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lean, self-contained build for Docker: `next build` copies only the
  // production node_modules subset + a minimal server into `.next/standalone`,
  // so the runtime image doesn't need `pnpm install` or the full node_modules
  // tree at all. See docker/README.md and the Dockerfile at the repo root.
  output: 'standalone',
};

export default nextConfig;
