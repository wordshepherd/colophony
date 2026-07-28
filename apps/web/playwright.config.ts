import { resolve } from "path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import {
  E2E_API_PORT,
  E2E_WEB_PORT,
  getPublicEnv,
  readZitadelConfig,
} from "./e2e/e2e-env";

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
 *
 * IMPORTANT: the web server runs in one of two modes (see `useProdBuild` below),
 * and they source `NEXT_PUBLIC_*` differently — the dev server takes them from
 * `webServer.env` at runtime, a production build has them inlined by
 * `scripts/build-e2e.ts`. Both read them from `e2e/e2e-env.ts` so the modes agree.
 */

// Load .env files from both app packages (does not override existing process.env)
dotenv.config({ path: resolve(__dirname, "../api/.env") });
dotenv.config({ path: resolve(__dirname, ".env.local") });

/**
 * CI runs the suites against a production build; local runs stay on the dev server.
 *
 * `next dev --turbo` compiles a route on its first request. Four times between
 * 2026-07-25 and 2026-07-28 a CI job got a genuine Next 404 from a route at that
 * boundary while its already-compiled siblings served 200 from the same process,
 * each time passing on rerun. `next start` serves an ahead-of-time build and has no
 * first-request compile boundary for a route to be lost at.
 *
 * Local keeps the dev server for hot reload and to avoid a build per iteration.
 * `E2E_PROD_BUILD` forces either mode — note it only selects the server command, so
 * `pnpm --filter @colophony/web build:e2e` must have been run first.
 */
const useProdBuild = process.env.E2E_PROD_BUILD
  ? process.env.E2E_PROD_BUILD !== "false"
  : !!process.env.CI;

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

// The NEXT_PUBLIC_* pair the app is built with (CI) or handed at runtime (local).
const publicEnv = getPublicEnv(isOidcE2e);

// projectId is a server-side value for API audience validation — Zitadel JWTs put
// the project ID (not client_id) in the `aud` claim — so it is not part of
// getPublicEnv() and is read separately.
const oidcProjectId = isOidcE2e ? (readZitadelConfig()?.projectId ?? "") : "";

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
    // The shared API server can only be in one auth mode at a time (see
    // webServer below): NODE_ENV=test with the interactive header, or a real
    // JWKS verifier for the oidc suite. One run cannot host both, so partition
    // the projects on the same flag that picks the mode. Doing it here rather
    // than by listing project names in a package script means a newly added
    // suite is included automatically instead of being silently skipped.
  ].filter((project) =>
    isOidcE2e ? project.name === "oidc" : project.name !== "oidc",
  ),

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
          // Same authority the browser bundle uses, so the API validates tokens
          // against the issuer that minted them.
          ZITADEL_AUTHORITY: publicEnv.NEXT_PUBLIC_ZITADEL_AUTHORITY,
          // Zitadel JWT aud contains the project_id as the resource audience
          ZITADEL_CLIENT_ID: oidcProjectId,
        }),
      },
    },
    {
      // `2>&1 | tee` rather than `stdout: "pipe"` — see NEXT_DEV_LOG above. Kept
      // for both modes: `next start` also logs a line per request, and the
      // artifact stays the first thing to read when a suite fails.
      command: `pnpm --filter @colophony/web ${useProdBuild ? "start" : "dev"} 2>&1 | tee ${NEXT_DEV_LOG}`,
      url: `http://localhost:${E2E_WEB_PORT}`,
      // Always start fresh — reusing a server started without the test OIDC
      // env vars causes an auth storage key mismatch (injectAuth writes to a
      // key derived from NEXT_PUBLIC_ZITADEL_AUTHORITY/CLIENT_ID).
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: "../..",
      env: {
        ...process.env,
        // `next start` honours PORT the same way `next dev` does.
        PORT: String(E2E_WEB_PORT),
        // next.config.ts is re-read by `next start`, not just by `next build`, so
        // this has to be set on both sides — otherwise the server resolves
        // `output: "standalone"` against a build that deliberately did not emit it
        // and warns on every startup. The E2E stack never wants the standalone
        // bundle in either mode.
        NEXT_E2E_BUILD: "1",
        // Only reaches the app in dev mode. A production build has these inlined
        // at build time by scripts/build-e2e.ts, which derives them from the same
        // getPublicEnv() call — passing them here is a no-op under `next start`.
        ...publicEnv,
      },
    },
  ],
});
