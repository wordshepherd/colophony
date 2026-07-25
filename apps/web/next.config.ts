import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Relative, not "@/env": tsconfig path aliases are not applied when Next loads
// this config file. Importing it here is the point of the module — an invalid
// environment fails `next build` instead of surfacing as undefined in a browser.
// Set SKIP_ENV_VALIDATION=1 to bypass (see apps/web/Dockerfile).
// Importing the module also validates the client (NEXT_PUBLIC_*) schema, since
// clientEnv is parsed at module load.
import { getServerEnv } from "./src/env";

const serverEnv = getServerEnv();

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
  org: serverEnv.SENTRY_ORG,
  project: serverEnv.SENTRY_PROJECT,
  // Only upload source maps in CI (requires auth token)
  authToken: serverEnv.SENTRY_AUTH_TOKEN,
  // CI is provided by the CI runner itself, not part of the app's env contract
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  // Tunnel Sentry events through the app to avoid ad blockers
  tunnelRoute:
    process.env.NODE_ENV === "production" ? "/monitoring" : undefined,
});
