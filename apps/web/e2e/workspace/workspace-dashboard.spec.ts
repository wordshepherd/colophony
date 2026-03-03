import { test, expect } from "../helpers/workspace-fixtures";

test.describe("Writer Workspace Dashboard (/workspace)", () => {
  test("displays Writer Workspace heading", async ({ authedPage }) => {
    await authedPage.goto("/workspace");

    await expect(
      authedPage.getByRole("heading", { name: "Writer Workspace" }),
    ).toBeVisible();
  });

  test("shows Track Submission link", async ({ authedPage }) => {
    await authedPage.goto("/workspace");

    // Scope to main content to avoid sidebar matches
    const main = authedPage.locator("main");
    const link = main.getByRole("link", { name: /Track Submission/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/workspace\/external\/new/);
  });

  test("renders quick action buttons", async ({ authedPage }) => {
    await authedPage.goto("/workspace");

    // Scope to main content to avoid sidebar link duplicates
    const main = authedPage.locator("main");
    await expect(
      main.getByRole("link", { name: /View External Submissions/ }),
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: /View Correspondence/ }),
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: /View Portfolio/ }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: /Analytics/ })).toBeVisible();
  });

  test("renders stat cards", async ({ authedPage }) => {
    await authedPage.goto("/workspace");

    // Scope to main content to avoid sidebar "Manuscripts" link
    const main = authedPage.locator("main");

    // At least one stat card text should be visible
    const statLabels = ["Manuscripts", "Pending", "Accepted", "Rejected"];
    let found = false;
    for (const label of statLabels) {
      const count = await main.getByText(label, { exact: true }).count();
      if (count > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
