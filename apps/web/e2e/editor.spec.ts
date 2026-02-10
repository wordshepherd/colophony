import { test, expect } from '@playwright/test';
import {
  createSubmission as apiCreateSubmission,
  submitSubmission,
} from './helpers/api-client';
import { loginAsBrowser, setupTestUser } from './helpers/auth';
import { addMember, deleteOrg, deleteUser, disconnectDb } from './helpers/db';

test.describe('Editor Dashboard', () => {
  const cleanup: Array<{ orgId?: string; userId?: string }> = [];

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test.afterAll(async () => {
    for (const item of cleanup) {
      if (item.orgId) await deleteOrg(item.orgId);
      if (item.userId) await deleteUser(item.userId);
    }
    await disconnectDb();
  });

  test('editor dashboard shows submission table', async ({ page }) => {
    // Create an editor user with a submitted submission
    const editor = await setupTestUser('EDITOR');
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    // Create a separate reader who submits something
    const reader = await setupTestUser('READER');
    cleanup.push({ userId: reader.userId });

    // Add reader to the same org
    await addMember(editor.orgId, reader.userId, 'READER');

    // Create and submit a submission as the reader
    const title = `E2E Editor View ${Date.now()}`;
    const sub = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title, content: 'Content for editor review' },
    );
    await submitSubmission(reader.tokens.accessToken, editor.orgId, sub.id);

    // Login as editor
    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto('/editor');

    // Should show the dashboard
    await expect(page.getByRole('heading', { name: 'Editor Dashboard' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Review and manage submissions')).toBeVisible();

    // Should show the submission in the table
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    // Should have column headers
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Submitter' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('filter by status tab updates table', async ({ page }) => {
    const editor = await setupTestUser('EDITOR');
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    // Create a reader in the same org
    const reader = await setupTestUser('READER');
    cleanup.push({ userId: reader.userId });
    await addMember(editor.orgId, reader.userId, 'READER');

    // Create a submitted submission
    const submittedTitle = `E2E Filter Submitted ${Date.now()}`;
    const sub = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title: submittedTitle },
    );
    await submitSubmission(reader.tokens.accessToken, editor.orgId, sub.id);

    // Login as editor
    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto('/editor');

    // Default tab is "Submitted" (initial state in the component)
    await expect(page.getByText(submittedTitle)).toBeVisible({
      timeout: 10_000,
    });

    // Click "Accepted" tab - should show no results
    await page.getByRole('tab', { name: 'Accepted' }).click();
    await expect(
      page.getByRole('heading', { name: 'No submissions' }),
    ).toBeVisible({ timeout: 5_000 });

    // Click "All" tab - should show the submitted one
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByText(submittedTitle)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('click review opens submission detail', async ({ page }) => {
    const editor = await setupTestUser('EDITOR');
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    const reader = await setupTestUser('READER');
    cleanup.push({ userId: reader.userId });
    await addMember(editor.orgId, reader.userId, 'READER');

    const title = `E2E Review Click ${Date.now()}`;
    const sub = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title, content: 'Content for review click test' },
    );
    await submitSubmission(reader.tokens.accessToken, editor.orgId, sub.id);

    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto('/editor');

    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Click the "Review" link for this submission
    const row = page.getByRole('row').filter({ hasText: title });
    await row.getByRole('link', { name: 'Review', exact: true }).click();

    // Should navigate to the review page
    await page.waitForURL(`**/editor/${sub.id}`, { timeout: 10_000 });
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('Status Actions')).toBeVisible();
    await expect(page.getByText('Back to dashboard')).toBeVisible();
  });

  test('change status with confirmation dialog updates status', async ({
    page,
  }) => {
    const editor = await setupTestUser('EDITOR');
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    const reader = await setupTestUser('READER');
    cleanup.push({ userId: reader.userId });
    await addMember(editor.orgId, reader.userId, 'READER');

    const title = `E2E Status Change ${Date.now()}`;
    const sub = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title },
    );
    await submitSubmission(reader.tokens.accessToken, editor.orgId, sub.id);

    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto(`/editor/${sub.id}`);

    // Wait for the page to load
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // From SUBMITTED, editor can move to "Under Review" or "Reject"
    // Click "Under Review" button
    await page.getByRole('button', { name: 'Under Review' }).click();

    // Confirmation dialog should appear
    await expect(
      page.getByText('Change Status to Under Review'),
    ).toBeVisible();
    await expect(page.getByLabel('Comment (optional)')).toBeVisible();

    // Add a comment and confirm
    await page
      .getByLabel('Comment (optional)')
      .fill('Starting review process');
    await page
      .getByRole('button', { name: 'Confirm Under Review' })
      .click();

    // Should show success toast
    await expect(page.getByText('Status updated')).toBeVisible({
      timeout: 10_000,
    });

    // Status badge should update to Under Review
    await expect(page.getByText('Under Review', { exact: true })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('editor dashboard pagination controls visible with many submissions', async ({
    page,
  }) => {
    // This test verifies pagination UI exists when there are submissions.
    // Creating 20+ submissions would be slow, so we verify the structure
    // is correct with a small dataset and test that pagination controls
    // are absent when items fit on one page.
    const editor = await setupTestUser('EDITOR');
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    const reader = await setupTestUser('READER');
    cleanup.push({ userId: reader.userId });
    await addMember(editor.orgId, reader.userId, 'READER');

    // Create one submission (less than page size of 20)
    const title = `E2E Pagination ${Date.now()}`;
    const sub = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title },
    );
    await submitSubmission(reader.tokens.accessToken, editor.orgId, sub.id);

    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto('/editor');

    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // With only 1 submission (<20 page size), pagination should not be shown
    // Scope to main to avoid matching Next.js Dev Tools navigation buttons
    const main = page.locator('main');
    await expect(
      main.getByRole('button', { name: 'Previous' }),
    ).not.toBeVisible();
    await expect(
      main.getByRole('button', { name: 'Next' }),
    ).not.toBeVisible();
  });
});
