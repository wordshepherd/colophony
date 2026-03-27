import { test, expect, EMBED_TEST_EMAIL } from "../helpers/embed-fixtures";

test.describe("Embed Status Check (/embed/status/:token)", () => {
  test("embed submission success page shows status link and confirmation message", async ({
    page,
    embedData,
  }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    // Complete identity
    await page.getByLabel(/email/i).fill(EMBED_TEST_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });

    // Fill form
    await page.getByLabel("Title *").fill("E2E Status Check Submission");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Fiction", exact: true }).click();

    // Submit
    await page.getByRole("button", { name: "Submit" }).click();

    // Success page
    await expect(
      page.getByRole("heading", { name: "Submission Received" }),
    ).toBeVisible({ timeout: 15_000 });

    // Verify confirmation message
    await expect(
      page.getByText("A confirmation email has been sent"),
    ).toBeVisible();

    // Verify status check link
    const statusLink = page.getByTestId("status-check-link");
    await expect(statusLink).toBeVisible();
    await expect(statusLink).toHaveText("Check your submission status");

    // Extract and verify the link points to the status page
    const href = await statusLink.getAttribute("href");
    expect(href).toMatch(/^\/embed\/status\/col_sta_/);
  });

  test("status check page displays submission info for valid token", async ({
    page,
    embedData,
  }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    // Complete identity
    await page.getByLabel(/email/i).fill(EMBED_TEST_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });

    // Fill form
    await page.getByLabel("Title *").fill("Status Page E2E Test");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Poetry" }).click();

    // Submit
    await page.getByRole("button", { name: "Submit" }).click();

    // Wait for success
    await expect(
      page.getByRole("heading", { name: "Submission Received" }),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to status page via the link
    const statusLink = page.getByTestId("status-check-link");
    await expect(statusLink).toBeVisible();
    const href = await statusLink.getAttribute("href");
    expect(href).toBeTruthy();

    await page.goto(href!);

    // Verify status page content
    await expect(page.getByText("Submission Status")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Status Page E2E Test")).toBeVisible();
    await expect(page.getByText("In Review")).toBeVisible();
    await expect(page.getByText(embedData.periodName)).toBeVisible();
  });

  test("status check page shows not found for invalid token", async ({
    page,
  }) => {
    await page.goto("/embed/status/col_sta_0000000000000000000000000000dead");

    await expect(page.getByText("Submission Not Found")).toBeVisible({
      timeout: 10_000,
    });
  });
});
