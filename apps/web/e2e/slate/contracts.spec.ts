import { test, expect } from "../helpers/slate-fixtures";
import {
  createContract,
  deleteContract,
  deleteContractTemplate,
} from "../helpers/slate-db";

test.describe("Contracts (/slate/contracts)", () => {
  test("displays heading and Templates link", async ({ authedPage }) => {
    await authedPage.goto("/slate/contracts");

    await expect(
      authedPage.getByRole("heading", { name: "Contracts" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: "Templates" }),
    ).toBeVisible();
  });

  test("shows contract in list", async ({ authedPage, seedOrg, slateData }) => {
    // Create a contract for the list test
    const contract = await createContract({
      orgId: seedOrg.id,
      pipelineItemId: slateData.pipelineItem.id,
      contractTemplateId: slateData.contractTemplate.id,
      renderedBody: "<p>E2E test contract body</p>",
      status: "DRAFT",
    });

    try {
      await authedPage.goto("/slate/contracts");

      // Contract list shows status badge — use .first() since seed data may add extra rows
      await expect(
        authedPage.locator("table").getByText("Draft").first(),
      ).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteContract(contract.id);
    }
  });

  test("navigates to templates list", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/contracts");

    await expect(
      authedPage.getByRole("link", { name: "Templates" }),
    ).toBeVisible({ timeout: 10_000 });

    await authedPage.getByRole("link", { name: "Templates" }).click();

    await expect(authedPage).toHaveURL(/\/slate\/contracts\/templates/);
    await expect(
      authedPage.getByRole("heading", { name: "Contract Templates" }),
    ).toBeVisible();

    // Template from slateData should be visible
    await expect(
      authedPage.getByText(slateData.contractTemplate.name),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("creates contract template via form", async ({ authedPage }) => {
    const suffix = Date.now().toString(36);
    const templateName = `E2E Template ${suffix}`;
    let createdId: string | undefined;

    try {
      await authedPage.goto("/slate/contracts/templates/new");

      await expect(
        authedPage.getByRole("heading", { name: "New Contract Template" }),
      ).toBeVisible();

      // Fill name
      await authedPage.getByLabel("Name").fill(templateName);

      // Fill description
      await authedPage.getByLabel("Description").fill("E2E created template");

      // Fill body — TipTap ProseMirror contenteditable editor
      // ProseMirror intercepts input at the DOM level; use keyboard.type after focus
      const editor = authedPage.locator("[contenteditable='true']").first();
      await editor.click();
      await authedPage.keyboard.type("This is the contract body text.", {
        delay: 20,
      });
      // Wait for debounced onChange (300ms) to propagate to react-hook-form
      await authedPage.waitForTimeout(500);

      // Submit
      await authedPage.getByRole("button", { name: "Create Template" }).click();

      // Should redirect to template detail
      await expect(authedPage).toHaveURL(/\/slate\/contracts\/templates\//, {
        timeout: 10_000,
      });
      await expect(authedPage.getByText(templateName)).toBeVisible();

      // Extract ID for cleanup
      const url = authedPage.url();
      const match = url.match(/\/slate\/contracts\/templates\/([0-9a-f-]+)/);
      createdId = match?.[1];
    } finally {
      if (createdId) {
        await deleteContractTemplate(createdId);
      }
    }
  });

  test("navigates to template detail", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/contracts/templates");

    await expect(
      authedPage.getByText(slateData.contractTemplate.name),
    ).toBeVisible({ timeout: 10_000 });

    await authedPage
      .getByRole("link", { name: slateData.contractTemplate.name })
      .click();

    await expect(authedPage).toHaveURL(
      new RegExp(`/slate/contracts/templates/${slateData.contractTemplate.id}`),
    );
    await expect(
      authedPage.getByText(slateData.contractTemplate.name),
    ).toBeVisible();
  });
});
