import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: "standalone",
  // Disable type checking during build (run separately with `pnpm type-check`)
  // Required because Next.js type-checks API code via tRPC shared types
  typescript: {
    ignoreBuildErrors: true,
  },
  // Transpile workspace packages
  transpilePackages: ["@colophony/types"],
};

export default nextConfig;
