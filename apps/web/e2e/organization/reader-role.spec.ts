import { test, expect } from "../helpers/reader-fixtures";

test.describe("READER role restrictions", () => {
  test("does not see editor sidebar navigation", async ({ authedPage }) => {
    await authedPage.goto("/submissions");

    // Wait for page to load
    await expect(
      authedPage.getByRole("link", { name: "My Submissions" }),
    ).toBeVisible();

    // Editor section should be hidden
    await expect(
      authedPage.getByRole("link", { name: "Editor Dashboard" }),
    ).not.toBeVisible();

    // Slate section should be hidden
    await expect(
      authedPage.getByRole("link", { name: "Slate Dashboard" }),
    ).not.toBeVisible();

    // Admin section should be hidden (Organization link)
    await expect(
      authedPage.getByRole("link", { name: "Organization" }),
    ).not.toBeVisible();

    // Submitter navigation should be visible
    await expect(
      authedPage.getByRole("link", { name: "Manuscripts" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: "Settings" }),
    ).toBeVisible();
  });

  test("sees org settings as read-only", async ({ authedPage }) => {
    await authedPage.goto("/organizations/settings");

    // Page should load
    await expect(
      authedPage.getByRole("heading", { name: "Organization Settings" }),
    ).toBeVisible();

    // Admin-only elements should be hidden
    await expect(
      authedPage.getByRole("button", { name: /save|update/i }),
    ).not.toBeVisible();

    // Danger Zone (delete org) should not be visible
    await expect(authedPage.getByText("Danger Zone")).not.toBeVisible();
  });

  test("cannot see invite member button on Members tab", async ({
    authedPage,
  }) => {
    await authedPage.goto("/organizations/settings");

    // Switch to Members tab
    const membersTab = authedPage.getByRole("tab", { name: "Members" });
    await expect(membersTab).toBeVisible();
    await membersTab.click();

    // Member list should load
    await expect(authedPage.getByText("Email")).toBeVisible();

    // Invite button should be hidden for non-admins
    await expect(
      authedPage.getByRole("button", { name: /invite member/i }),
    ).not.toBeVisible();
  });
});
