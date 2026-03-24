import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in CI (requires auth token)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  // Tunnel Sentry events through the app to avoid ad blockers
  tunnelRoute:
    process.env.NODE_ENV === "production" ? "/monitoring" : undefined,
});
