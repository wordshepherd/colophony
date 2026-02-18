import { resolve } from "path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for browser E2E tests.
 *
 * Prerequisites:
 * - docker-compose up (PostgreSQL)
 * - pnpm db:migrate && pnpm db:seed
 *
 * The webServer config starts both the API and Web dev servers automatically.
 *
 * Auth strategy: Fake OIDC user injected into localStorage (satisfies frontend
 * auth checks), tRPC requests intercepted to swap Bearer token for API key
 * (satisfies API auth). No Zitadel instance required.
 *
 * IMPORTANT: Playwright's webServer.env replaces process.env entirely for child
 * processes. We must load .env files and spread process.env to ensure DATABASE_URL
 * and other vars reach the dev servers.
 */

// Load .env files from both app packages (does not override existing process.env)
dotenv.config({ path: resolve(__dirname, "../api/.env") });
dotenv.config({ path: resolve(__dirname, ".env.local") });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run tests sequentially (shared database state)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker to avoid DB conflicts
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @colophony/api dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
      env: {
        ...process.env,
        VIRUS_SCAN_ENABLED: "false",
      },
    },
    {
      command: "pnpm --filter @colophony/web dev",
      url: "http://localhost:3000",
      // Always start fresh — reusing a server started without the test OIDC
      // env vars causes an auth storage key mismatch (injectAuth writes to a
      // key derived from NEXT_PUBLIC_ZITADEL_AUTHORITY/CLIENT_ID).
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: "../..",
      env: {
        ...process.env,
        NEXT_PUBLIC_ZITADEL_AUTHORITY: "http://test-idp:8080",
        NEXT_PUBLIC_ZITADEL_CLIENT_ID: "test-client",
      },
    },
  ],
});
