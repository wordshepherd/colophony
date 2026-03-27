import { test, expect } from "../helpers/fixtures";

test.describe("Submission List (/submissions)", () => {
  test("displays My Submissions heading", async ({ authedPage }) => {
    await authedPage.goto("/submissions");
    await expect(
      authedPage.getByRole("heading", { name: "My Submissions" }),
    ).toBeVisible();
  });

  test("shows New Submission button", async ({ authedPage }) => {
    await authedPage.goto("/submissions");
    await expect(
      authedPage.getByRole("link", { name: /New Submission/ }),
    ).toBeVisible();
  });

  test("renders status filter tabs", async ({ authedPage }) => {
    await authedPage.goto("/submissions");
    await expect(authedPage.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(authedPage.getByRole("tab", { name: "Drafts" })).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Received" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "In Review" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Accepted" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Decision Sent" }),
    ).toBeVisible();
  });

  test("shows seed submissions in the list", async ({ authedPage }) => {
    await authedPage.goto("/submissions");

    // Wait for submissions to load (skeleton disappears)
    await expect(
      authedPage.getByText("The Weight of Small Things"),
    ).toBeVisible({ timeout: 10_000 });

    // Verify other seed submissions are visible
    await expect(authedPage.getByText("Cartography of Absence")).toBeVisible();
    await expect(
      authedPage.getByText("Field Notes on Disappearing"),
    ).toBeVisible();
  });

  test("New Submission button navigates to /submissions/new", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions");
    await authedPage.getByRole("link", { name: /New Submission/ }).click();
    await expect(authedPage).toHaveURL(/\/submissions\/new/);
  });

  test("filter by Received tab shows only submitted items", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions");

    // Wait for list to load
    await expect(
      authedPage.getByText("The Weight of Small Things"),
    ).toBeVisible({ timeout: 10_000 });

    // Click Received tab (writer-projected name for SUBMITTED)
    await authedPage.getByRole("tab", { name: "Received" }).click();

    // "The Weight of Small Things" is SUBMITTED — should be visible
    await expect(
      authedPage.getByText("The Weight of Small Things"),
    ).toBeVisible();

    // UNDER_REVIEW and ACCEPTED should not be visible
    await expect(
      authedPage.getByText("Cartography of Absence"),
    ).not.toBeVisible();
    await expect(
      authedPage.getByText("Field Notes on Disappearing"),
    ).not.toBeVisible();
  });

  test("filter by Decision Sent tab shows empty state", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions");

    // Wait for list to load first
    await expect(
      authedPage.getByText("The Weight of Small Things"),
    ).toBeVisible({ timeout: 10_000 });

    // Click Decision Sent tab (writer-projected name for REJECTED)
    await authedPage.getByRole("tab", { name: "Decision Sent" }).click();

    // Should show empty state message
    await expect(
      authedPage.getByRole("heading", { name: "No submissions" }),
    ).toBeVisible();
  });
});
