import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Task 89 (HTTP layer): gzip text responses from the Next server itself -
  // the preview gateway's Caddy only reverse-proxies, it does not encode.
  compress: true,
  // Do not advertise the framework version on every response.
  poweredByHeader: false,
  // Test isolation (audit P1-10): a second dev server for the test toolchain
  // can boot alongside the real one when it gets its own dist dir - otherwise
  // Turbopack locks .next/dev/lock and refuses. NEXT_DIST_DIR is set ONLY by
  // the isolated battery runner; normal dev/build never see it.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
