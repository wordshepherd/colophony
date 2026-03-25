import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for browser E2E tests.
 *
 * Three projects:
 * - submissions: existing tests (fake OIDC + API key interception, no external services)
 * - uploads: requires tusd + Garage (docker-compose.e2e.yml)
 * - oidc: requires Zitadel (docker-compose --profile auth)
 *
 * IMPORTANT: Playwright's webServer.env replaces process.env entirely for child
 * processes. We must load .env files and spread process.env to ensure DATABASE_URL
 * and other vars reach the dev servers.
 */

// Load .env files from both app packages (does not override existing process.env)
dotenv.config({ path: resolve(__dirname, "../api/.env") });
dotenv.config({ path: resolve(__dirname, ".env.local") });

/**
 * E2E servers run on dedicated ports (4010/3010) so they never collide with
 * dev servers on the default ports (4000/3000).
 */
const E2E_API_PORT = 4010;
const E2E_WEB_PORT = 3010;

/**
 * When OIDC_E2E=true, load real Zitadel config for OIDC project tests.
 * Otherwise, use fake values for submissions/uploads projects.
 */
const isOidcE2e = process.env.OIDC_E2E === "true";

let oidcAuthority = "http://test-idp:8080";
let oidcClientId = "test-client";

// projectId is used for API audience validation: Zitadel JWT tokens put
// the project ID (not client_id) in the `aud` claim.
let oidcProjectId = "";

if (isOidcE2e) {
  const configPath = resolve(__dirname, "e2e/.zitadel-e2e-config.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
      authority: string;
      clientId: string;
      projectId: string;
    };
    oidcAuthority = config.authority;
    oidcClientId = config.clientId;
    oidcProjectId = config.projectId;
  }
}

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
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "submissions",
      testDir: "./e2e/submissions",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "uploads",
      testDir: "./e2e/uploads",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "oidc",
      testDir: "./e2e/oidc",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "embed",
      testDir: "./e2e/embed",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "slate",
      testDir: "./e2e/slate",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "workspace",
      testDir: "./e2e/workspace",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "forms",
      testDir: "./e2e/forms",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "organization",
      testDir: "./e2e/organization",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "analytics",
      testDir: "./e2e/analytics",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "federation",
      testDir: "./e2e/federation",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter @colophony/api dev",
      url: `http://localhost:${E2E_API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
      env: {
        ...process.env,
        PORT: String(E2E_API_PORT),
        CORS_ORIGIN: `http://localhost:${E2E_WEB_PORT}`,
        VIRUS_SCAN_ENABLED: "false",
        // Raise rate limits for E2E: tests × ~5 requests each can exceed default 60/min
        RATE_LIMIT_DEFAULT_MAX: "1000",
        RATE_LIMIT_AUTH_MAX: "1000",
        ...(isOidcE2e && {
          ZITADEL_AUTHORITY: oidcAuthority,
          // Zitadel JWT aud contains the project_id as the resource audience
          ZITADEL_CLIENT_ID: oidcProjectId,
        }),
      },
    },
    {
      command: "pnpm --filter @colophony/web dev",
      url: `http://localhost:${E2E_WEB_PORT}`,
      // Always start fresh — reusing a server started without the test OIDC
      // env vars causes an auth storage key mismatch (injectAuth writes to a
      // key derived from NEXT_PUBLIC_ZITADEL_AUTHORITY/CLIENT_ID).
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: "../..",
      env: {
        ...process.env,
        PORT: String(E2E_WEB_PORT),
        NEXT_PUBLIC_API_URL: `http://localhost:${E2E_API_PORT}`,
        NEXT_PUBLIC_ZITADEL_AUTHORITY: oidcAuthority,
        NEXT_PUBLIC_ZITADEL_CLIENT_ID: oidcClientId,
        NEXT_PUBLIC_TUS_URL: "http://localhost:1080/files/",
      },
    },
  ],
});
