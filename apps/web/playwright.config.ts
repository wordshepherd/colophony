import { readFileSync } from "fs";
import { resolve } from "path";
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
 */

/**
 * Load a .env file into a key-value record.
 * Minimal parser — handles KEY=VALUE lines, skips comments and blanks.
 */
function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const apiEnv = loadEnvFile(resolve(__dirname, "../api/.env"));
const webEnv = loadEnvFile(resolve(__dirname, ".env.local"));

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
        ...apiEnv,
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
        ...webEnv,
        NEXT_PUBLIC_ZITADEL_AUTHORITY: "http://test-idp:8080",
        NEXT_PUBLIC_ZITADEL_CLIENT_ID: "test-client",
      },
    },
  ],
});
