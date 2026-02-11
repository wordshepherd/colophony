import { test, expect } from "@playwright/test";
import {
  createSubmission as apiCreateSubmission,
  submitSubmission,
} from "./helpers/api-client";
import { loginAsBrowser, loginViaForm, setupTestUser } from "./helpers/auth";
import {
  addMember,
  deleteOrg,
  deleteUser,
  disconnectDb,
  getUserByEmail,
} from "./helpers/db";

test.describe("Core User Journeys", () => {
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

  test("register via form → verify success and navigate to login", async ({
    page,
  }) => {
    const suffix =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const email = `e2e-journey-register-${suffix}@test.local`;

    await page.goto("/register");

    // Fill registration form
    await page.getByLabel("Name (optional)").fill("Journey Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("checkbox").click();
    await page.getByRole("button", { name: "Create account" }).click();

    // Verify success screen
    await expect(page.getByText("Check your email")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("We've sent a verification link"),
    ).toBeVisible();

    // Navigate back to login
    await page.getByRole("button", { name: "Back to login" }).click();

    // Verify login page loads
    await page.waitForURL("**/login", { timeout: 10_000 });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    // Clean up
    const user = await getUserByEmail(email);
    if (user) cleanup.push({ userId: user.id });
  });

  test("login via form → select org → verify submissions page renders", async ({
    page,
  }) => {
    const user = await setupTestUser("READER");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Login through the actual form (not localStorage shortcut)
    await loginViaForm(page, user.email, user.password);

    // Wait for the full redirect chain:
    // /login → form submit → router.push("/") → Home detects tokens → /submissions
    await page.waitForURL("**/submissions", { timeout: 15_000 });

    // After form login, org is not yet selected — select it via the org switcher
    await page.getByRole("button", { name: /Select organiz/ }).click();
    await page.getByText(user.orgName).click();

    // Verify the submissions page renders with real content
    await expect(
      page.getByRole("heading", { name: "My Submissions" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Manage and track your submissions"),
    ).toBeVisible();
    await expect(page.getByText("New Submission")).toBeVisible();
  });

  test("create submission → verify in list → navigate to detail", async ({
    page,
  }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    await loginAsBrowser(page, user.tokens, user.orgId);

    // Create a submission via the UI
    const title = `Journey Create Test ${Date.now()}`;
    await page.goto("/submissions/new");
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Title *").fill(title);
    await page
      .getByLabel("Content")
      .fill("Content created during journey test.");
    await page.getByRole("button", { name: "Create Draft" }).click();

    // Should redirect to detail page
    await page.waitForURL("**/submissions/**", { timeout: 10_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Navigate to submissions list
    await page.goto("/submissions");
    await expect(
      page.getByRole("heading", { name: "My Submissions" }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify submission appears in the list
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Click the submission card to navigate to detail page
    await page.getByText(title).click();

    // Verify detail page renders with the correct title
    await page.waitForURL("**/submissions/**", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
  });

  test("full submission lifecycle: submit → review → accept → verify as reader", async ({
    page,
  }) => {
    // Setup editor and reader in the same org
    const editor = await setupTestUser("EDITOR");
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    const reader = await setupTestUser("READER");
    cleanup.push({ userId: reader.userId });
    await addMember(editor.orgId, reader.userId, "READER");

    // Reader submits via API
    const title = `Journey Lifecycle ${Date.now()}`;
    const sub = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title, content: "Lifecycle test content" },
    );
    await submitSubmission(reader.tokens.accessToken, editor.orgId, sub.id);

    // --- Editor flow ---
    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto("/editor");

    // Editor sees the submission
    await expect(
      page.getByRole("heading", { name: "Editor Dashboard" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Click Review to navigate to detail
    const row = page.getByRole("row").filter({ hasText: title });
    await row.getByRole("link", { name: "Review", exact: true }).click();
    await page.waitForURL(`**/editor/${sub.id}`, { timeout: 10_000 });

    // Transition: SUBMITTED → UNDER_REVIEW
    await page.getByRole("button", { name: "Under Review" }).click();
    await expect(page.getByText("Change Status to Under Review")).toBeVisible();
    await page.getByLabel("Comment (optional)").fill("Starting review process");
    await page.getByRole("button", { name: "Confirm Under Review" }).click();
    await expect(page.getByText("Status updated")).toBeVisible({
      timeout: 10_000,
    });

    // Transition: UNDER_REVIEW → ACCEPTED
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Accept Submission")).toBeVisible();
    await page.getByRole("button", { name: "Confirm Accept" }).click();
    await expect(page.getByText("Status updated")).toBeVisible({
      timeout: 10_000,
    });

    // --- Reader flow ---
    // Clear editor session and log in as reader
    await page.evaluate(() => localStorage.clear());
    await loginAsBrowser(page, reader.tokens, editor.orgId);
    await page.goto("/submissions");

    // Reader sees the submission with "Accepted" status
    await expect(
      page.getByRole("heading", { name: "My Submissions" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("ACCEPTED")).toBeVisible({ timeout: 5_000 });
  });

  test("cross-role visibility: editor cannot see drafts, sees submitted", async ({
    page,
  }) => {
    const editor = await setupTestUser("EDITOR");
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    const reader = await setupTestUser("READER");
    cleanup.push({ userId: reader.userId });
    await addMember(editor.orgId, reader.userId, "READER");

    // Reader creates a DRAFT submission via API
    const draftTitle = `Journey Draft ${Date.now()}`;
    const draft = await apiCreateSubmission(
      reader.tokens.accessToken,
      editor.orgId,
      { title: draftTitle },
    );

    // Editor: /editor default "Submitted" tab → draft should NOT be visible
    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto("/editor");
    await expect(
      page.getByRole("heading", { name: "Editor Dashboard" }),
    ).toBeVisible({ timeout: 10_000 });

    // Default tab is "Submitted" — draft should not appear here
    // Wait for table/empty state to render, then verify draft is absent
    await expect(page.getByRole("tab", { name: "Submitted" })).toHaveAttribute(
      "data-state",
      "active",
      { timeout: 5_000 },
    );
    await expect(page.getByText(draftTitle)).not.toBeVisible();

    // Reader submits the draft via API
    await submitSubmission(reader.tokens.accessToken, editor.orgId, draft.id);

    // Editor: refresh /editor → submission now visible on "Submitted" tab
    await page.goto("/editor");
    await expect(
      page.getByRole("heading", { name: "Editor Dashboard" }),
    ).toBeVisible({ timeout: 10_000 });

    // Default "Submitted" tab — newly submitted submission should appear
    await expect(page.getByText(draftTitle)).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar nav links all render valid pages", async ({ page }) => {
    // Login as EDITOR to see all nav items (including editor-only links)
    const editor = await setupTestUser("EDITOR");
    cleanup.push({ orgId: editor.orgId, userId: editor.userId });

    await loginAsBrowser(page, editor.tokens, editor.orgId);
    await page.goto("/submissions");

    // Wait for the sidebar to render
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Collect all nav link hrefs from the sidebar
    const navLinks = sidebar.locator("nav a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    const hrefs: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      if (href) hrefs.push(href);
    }

    // Visit each link and verify it renders a heading in main (no 404)
    for (const href of hrefs) {
      await page.goto(href);
      const main = page.locator("main");
      await expect(main).toBeVisible({ timeout: 10_000 });

      // Each valid page should have an h1 heading
      await expect(main.locator("h1").first()).toBeVisible({ timeout: 10_000 });

      // Should NOT show "404" or "not found" text in main
      const mainText = await main.textContent();
      expect(mainText?.toLowerCase()).not.toContain("404");
      expect(mainText?.toLowerCase()).not.toContain("not found");
    }
  });
});
