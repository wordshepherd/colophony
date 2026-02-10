import { test, expect } from '@playwright/test';
import {
  loginAsBrowser,
  loginViaForm,
  setupTestUser,
  clearAuthTokensInBrowser,
} from './helpers/auth';
import { deleteOrg, deleteUser, disconnectDb, getUserByEmail } from './helpers/db';

test.describe('Authentication', () => {
  // Track created resources for cleanup
  const cleanup: Array<{ orgId?: string; userId?: string }> = [];

  test.afterEach(async ({ page }) => {
    // Clear browser state
    await page.evaluate(() => localStorage.clear());
  });

  test.afterAll(async () => {
    // Clean up test data
    for (const item of cleanup) {
      if (item.orgId) await deleteOrg(item.orgId);
      if (item.userId) await deleteUser(item.userId);
    }
    await disconnectDb();
  });

  test('login page shows login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText("Don't have an account?")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  });

  test('login with valid credentials redirects to /submissions', async ({
    page,
  }) => {
    const user = await setupTestUser('READER');
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    await loginViaForm(page, user.email, user.password);

    // Should redirect to submissions page
    await page.waitForURL('**/submissions', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/submissions/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nonexistent@test.local');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should show error message (stay on login page)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('register page shows registration form', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByText('Create an account')).toBeVisible();
    await expect(page.getByLabel('Name (optional)')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByText('I accept the')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create account' }),
    ).toBeVisible();
    await expect(page.getByText('Already have an account?')).toBeVisible();
  });

  test('register new account shows success message', async ({ page }) => {
    const suffix =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `e2e-register-${suffix}@test.local`;

    await page.goto('/register');

    await page.getByLabel('Name (optional)').fill('E2E Test User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('TestPassword123!');
    // Click the terms checkbox
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Create account' }).click();

    // Should show success message
    await expect(page.getByText('Check your email')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("We've sent a verification link"),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Back to login' }),
    ).toBeVisible();

    // Clean up: get user ID for deletion
    const user = await getUserByEmail(email);
    if (user) cleanup.push({ userId: user.id });
  });

  test('protected route /submissions redirects to /login when unauthenticated', async ({
    page,
  }) => {
    // Ensure no auth tokens
    await page.goto('/login');
    await clearAuthTokensInBrowser(page);

    // Try to access protected route
    await page.goto('/submissions');

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout redirects to /login', async ({ page }) => {
    const user = await setupTestUser('READER');
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Log in via localStorage (fast)
    await loginAsBrowser(page, user.tokens, user.orgId);

    // Navigate to a protected page
    await page.goto('/submissions');
    await page.waitForURL('**/submissions', { timeout: 10_000 });

    // Open user menu (avatar button shows 2-char initials from email)
    await page.getByRole('button', { name: /^[A-Z0-9]{2}$/i }).click();
    await page.getByText('Sign out').click();

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
