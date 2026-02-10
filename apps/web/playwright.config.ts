import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for browser E2E tests.
 *
 * Prerequisites:
 * - docker-compose up (PostgreSQL, Redis)
 * - pnpm db:generate && pnpm db:push
 *
 * The webServer config starts both the API and Web dev servers automatically.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run tests sequentially (shared database state)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker to avoid DB conflicts
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

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
      command: "pnpm --filter @prospector/api dev",
      url: "http://localhost:4000/trpc/auth.me",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
    {
      command: "pnpm --filter @prospector/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: "../..",
    },
  ],
});
