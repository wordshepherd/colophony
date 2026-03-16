import { test, expect } from "../helpers/organization-fixtures";

test.describe("Notification Preferences (/settings)", () => {
  test("settings page displays Notification Preferences card", async ({
    authedPage,
  }) => {
    await authedPage.goto("/settings");

    const main = authedPage.locator("main");
    await expect(main.getByText("Notification Preferences")).toBeVisible({
      timeout: 10_000,
    });
    await expect(main.getByText("Submissions")).toBeVisible();
    await expect(main.getByText("Publication Pipeline")).toBeVisible();
  });

  test("toggle email channel persists on reload", async ({ authedPage }) => {
    await authedPage.goto("/settings");

    const main = authedPage.locator("main");

    // Wait for preferences to load
    await expect(main.getByText("Submission Received")).toBeVisible({
      timeout: 10_000,
    });

    // Toggle "Submission Received" email off
    const emailSwitch = main.getByRole("switch", {
      name: "Toggle Submission Received email notifications",
    });
    await expect(emailSwitch).toBeVisible();

    // Default is checked (enabled) — click to disable
    await emailSwitch.click();

    // Wait for success toast
    await expect(
      authedPage.getByText("Notification preference updated"),
    ).toBeVisible({ timeout: 5_000 });

    // Reload and verify persisted
    await authedPage.reload();
    await expect(main.getByText("Submission Received")).toBeVisible({
      timeout: 10_000,
    });

    const emailSwitchAfter = main.getByRole("switch", {
      name: "Toggle Submission Received email notifications",
    });
    await expect(emailSwitchAfter).not.toBeChecked();
  });

  test("toggle in-app independently from email", async ({ authedPage }) => {
    await authedPage.goto("/settings");

    const main = authedPage.locator("main");
    await expect(main.getByText("Submission Accepted")).toBeVisible({
      timeout: 10_000,
    });

    const inAppSwitch = main.getByRole("switch", {
      name: "Toggle Submission Accepted in-app notifications",
    });
    const emailSwitch = main.getByRole("switch", {
      name: "Toggle Submission Accepted email notifications",
    });

    // Toggle in-app off
    await inAppSwitch.click();

    // Wait for the switch state to update (more reliable than toast)
    await expect(inAppSwitch).not.toBeChecked({ timeout: 5_000 });

    // Email should still be on
    await expect(emailSwitch).toBeChecked();
  });

  test("disable both channels for an event", async ({ authedPage }) => {
    await authedPage.goto("/settings");

    const main = authedPage.locator("main");
    await expect(main.getByText("Submission Rejected")).toBeVisible({
      timeout: 10_000,
    });

    const emailSwitch = main.getByRole("switch", {
      name: "Toggle Submission Rejected email notifications",
    });
    const inAppSwitch = main.getByRole("switch", {
      name: "Toggle Submission Rejected in-app notifications",
    });

    // Toggle email off
    await emailSwitch.click();
    await expect(
      authedPage.getByText("Notification preference updated"),
    ).toBeVisible({ timeout: 5_000 });

    // Toggle in-app off
    await inAppSwitch.click();
    await expect(
      authedPage.getByText("Notification preference updated").nth(1),
    ).toBeVisible({ timeout: 5_000 });

    // Reload and verify both unchecked
    await authedPage.reload();
    await expect(main.getByText("Submission Rejected")).toBeVisible({
      timeout: 10_000,
    });

    const emailSwitchAfter = main.getByRole("switch", {
      name: "Toggle Submission Rejected email notifications",
    });
    const inAppSwitchAfter = main.getByRole("switch", {
      name: "Toggle Submission Rejected in-app notifications",
    });

    await expect(emailSwitchAfter).not.toBeChecked();
    await expect(inAppSwitchAfter).not.toBeChecked();
  });
});
