import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for browser E2E tests.
 *
 * Ten projects. Most need nothing beyond Postgres and seed data; three have
 * external prerequisites:
 * - uploads: requires tusd + Garage (docker-compose.e2e.yml)
 * - oidc: requires Zitadel (docker-compose --profile auth)
 * - embed: public embed forms, no authenticated principal
 *
 * Auth model: every suite except `oidc` and `embed` authenticates through the
 * API's interactive test path (`x-test-user-id`, apps/api/src/hooks/auth.ts).
 * That path is gated on NODE_ENV=test AND the absence of a JWKS verifier, so
 * the API webServer below sets both. `oidc` drives a real Zitadel login and
 * therefore keeps the verifier.
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
 * Where the Next dev server's own output is kept.
 *
 * Playwright's `webServer.stdout` defaults to "ignore" (only `stderr` defaults
 * to "pipe"), so Next's `Ready` line, its per-route `Compiling`/`Compiled`
 * output, and any Turbopack diagnostic were being discarded — which is why past
 * investigations of the intermittent `(dashboard)` 404 had six `[WebServer]`
 * stderr warnings to work from and nothing else.
 *
 * Teeing to a file rather than setting `stdout: "pipe"` keeps the job log
 * readable and, more importantly, produces an artifact that outlives the run.
 * Path is relative to `cwd` below, which is the repo root.
 *
 * See docs/backlog.md, Track 1 QA/Testing.
 */
const NEXT_DEV_LOG = "apps/web/next-e2e.log";

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
  // In CI, run BOTH reporters. "github" emits inline annotations on the PR, but
  // it writes no files — on its own it leaves apps/web/playwright-report/ empty,
  // so the workflow's upload step finds nothing and every failure lands with no
  // trace, screenshot, or report to inspect. The html reporter produces that
  // directory; `open: "never"` stops it trying to launch a browser on the runner.
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],
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
        // Enable the interactive test-auth path (x-test-user-id). It requires
        // BOTH NODE_ENV=test and no JWKS verifier — see hooks/auth.ts. The
        // empty ZITADEL_AUTHORITY is load-bearing: apps/api/.env sets a real
        // one, which reaches this process via dotenv above and the API's own
        // --env-file-if-exists. Its zod schema maps '' -> undefined before the
        // .url() check, so this clears it rather than failing validation.
        // Node's --env-file does not override an already-set variable, so this
        // wins over apps/api/.env.
        ...(isOidcE2e ? {} : { NODE_ENV: "test", ZITADEL_AUTHORITY: "" }),
        ...(isOidcE2e && {
          ZITADEL_AUTHORITY: oidcAuthority,
          // Zitadel JWT aud contains the project_id as the resource audience
          ZITADEL_CLIENT_ID: oidcProjectId,
        }),
      },
    },
    {
      // `2>&1 | tee` rather than `stdout: "pipe"` — see NEXT_DEV_LOG above.
      command: `pnpm --filter @colophony/web dev 2>&1 | tee ${NEXT_DEV_LOG}`,
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
