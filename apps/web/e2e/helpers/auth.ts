/**
 * Browser auth helpers for Playwright E2E tests.
 *
 * Provides utilities to authenticate users in the browser by:
 * 1. Registering/logging in via the API
 * 2. Setting localStorage tokens in the browser context
 */

import { type Page } from "@playwright/test";
import { registerUser, loginUser, getMe } from "./api-client";
import { createOrg, addMember, getUserByEmail } from "./db";

/**
 * Set auth tokens in the browser's localStorage.
 * Must be called after page.goto() to a page on the same origin.
 */
export async function setAuthTokensInBrowser(
  page: Page,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  orgId?: string,
): Promise<void> {
  await page.evaluate(
    ({ tokens: t, orgId: o }) => {
      localStorage.setItem("accessToken", t.accessToken);
      localStorage.setItem("refreshToken", t.refreshToken);
      localStorage.setItem(
        "tokenExpiresAt",
        String(Date.now() + t.expiresIn * 1000),
      );
      if (o) {
        localStorage.setItem("currentOrgId", o);
      }
    },
    { tokens, orgId },
  );
}

/**
 * Clear auth tokens from the browser's localStorage.
 */
export async function clearAuthTokensInBrowser(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("tokenExpiresAt");
    localStorage.removeItem("currentOrgId");
  });
}

/**
 * Register a user via the API and return credentials + org info.
 * Sets up a complete test environment with an org and membership.
 */
export async function setupTestUser(
  role: "ADMIN" | "EDITOR" | "READER" = "READER",
): Promise<{
  email: string;
  password: string;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  userId: string;
  orgId: string;
  orgName: string;
}> {
  const suffix =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `e2e-${role.toLowerCase()}-${suffix}@test.local`;
  const password = "TestPassword123!";

  // Register user via API
  const tokens = await registerUser({ email, password });

  // Get user ID
  const user = await getUserByEmail(email);
  if (!user) throw new Error(`User not found after registration: ${email}`);

  // Create org and add user as member
  const org = await createOrg({
    name: `E2E Test Org ${suffix}`,
    slug: `e2e-org-${suffix}`,
  });
  await addMember(org.id, user.id, role);

  return {
    email,
    password,
    tokens,
    userId: user.id,
    orgId: org.id,
    orgName: org.name,
  };
}

/**
 * Log in a user in the browser by setting tokens directly in localStorage.
 * Much faster than going through the login form for every test.
 *
 * Call this AFTER page.goto() to ensure localStorage is available.
 */
export async function loginAsBrowser(
  page: Page,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  orgId: string,
): Promise<void> {
  // Navigate to a page on the origin first (needed for localStorage)
  await page.goto("/login");
  await setAuthTokensInBrowser(page, tokens, orgId);
}

/**
 * Log in through the UI form (for testing the login flow itself).
 */
export async function loginViaForm(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
