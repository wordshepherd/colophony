import { test, expect } from "../helpers/organization-fixtures";

test.describe("Organization Settings (/organizations/settings)", () => {
  test("displays Organization Settings heading", async ({ authedPage }) => {
    await authedPage.goto("/organizations/settings");

    await expect(
      authedPage.getByRole("heading", { name: "Organization Settings" }),
    ).toBeVisible();

    // Verify all tabs are present
    await expect(
      authedPage.getByRole("tab", { name: "General" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Members" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Email Templates" }),
    ).toBeVisible();
    await expect(authedPage.getByRole("tab", { name: "Voting" })).toBeVisible();
  });

  test("shows org name and slug on General tab", async ({ authedPage }) => {
    await authedPage.goto("/organizations/settings");

    // Wait for the form to load (name input should have a value)
    const nameInput = authedPage.getByLabel("Organization Name");
    await expect(nameInput).toBeVisible();
    await expect(nameInput).not.toHaveValue("");

    // Slug should be displayed as text (read-only)
    await expect(authedPage.getByText("Slug")).toBeVisible();
  });

  test("updates org name", async ({ authedPage }) => {
    await authedPage.goto("/organizations/settings");

    const nameInput = authedPage.getByLabel("Organization Name");
    await expect(nameInput).toBeVisible();

    // Store original name for cleanup
    const originalName = await nameInput.inputValue();

    // Update the name
    await nameInput.clear();
    await nameInput.fill("Updated Quarterly Review");
    await authedPage.getByRole("button", { name: "Save Changes" }).click();

    // Assert success toast
    await expect(authedPage.getByText("Organization updated")).toBeVisible();

    // Reload and verify persistence
    await authedPage.reload();
    await expect(nameInput).toHaveValue("Updated Quarterly Review");

    // Cleanup: restore original name
    await nameInput.clear();
    await nameInput.fill(originalName);
    await authedPage.getByRole("button", { name: "Save Changes" }).click();
    await expect(authedPage.getByText("Organization updated")).toBeVisible();
  });

  test("shows Danger Zone with delete button for admin", async ({
    authedPage,
  }) => {
    await authedPage.goto("/organizations/settings");

    // Scroll down to Danger Zone (CardTitle renders as <div>, not heading)
    const dangerZoneText = authedPage.getByText("Danger Zone");
    await dangerZoneText.scrollIntoViewIfNeeded();
    await expect(dangerZoneText).toBeVisible();

    // Delete Organization button should be visible
    await expect(
      authedPage.getByRole("button", { name: "Delete Organization" }),
    ).toBeVisible();
  });
});
