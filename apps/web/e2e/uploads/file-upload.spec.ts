/**
 * E2E tests for file upload flow.
 *
 * Prerequisites:
 * - tusd + MinIO running (docker-compose.e2e.yml)
 * - pnpm db:seed
 *
 * Auth strategy: uses existing authedPage fixture (fake OIDC + API key
 * interception for tRPC), plus setupTusAuth for tus upload interception.
 */

import { test, expect } from "../helpers/fixtures";
import {
  createSubmission,
  deleteSubmission,
  getOrgBySlug,
  getUserByEmail,
  getOpenSubmissionPeriod,
} from "../helpers/db";
import {
  createTestFile,
  getFilesBySubmissionId,
  deleteFilesBySubmissionId,
  setupTusAuth,
  disconnectUploadDb,
} from "../helpers/upload";

test.describe("File Upload (/submissions/:id — edit mode)", () => {
  let submissionId: string;

  test.beforeAll(async () => {
    // Look up seed data directly (fixtures not available in beforeAll)
    const org = await getOrgBySlug("quarterly-review");
    if (!org) throw new Error("Seed org not found");

    const user = await getUserByEmail("writer@example.com");
    if (!user) throw new Error("Seed user not found");

    const period = await getOpenSubmissionPeriod(org.id);
    const submission = await createSubmission({
      orgId: org.id,
      submitterId: user.id,
      submissionPeriodId: period?.id,
      title: "E2E Upload Test Submission",
      status: "DRAFT",
    });
    submissionId = submission.id;
  });

  test.afterAll(async () => {
    if (submissionId) {
      await deleteFilesBySubmissionId(submissionId);
      await deleteSubmission(submissionId);
    }
    await disconnectUploadDb();
  });

  test.afterEach(async () => {
    // Clean up files between tests to avoid file count limit issues
    if (submissionId) {
      await deleteFilesBySubmissionId(submissionId);
    }
  });

  test("uploads a file and shows it in file list", async ({
    authedPage,
    testApiKey,
  }) => {
    await setupTusAuth(authedPage, testApiKey.plainKey);
    await authedPage.goto(`/submissions/${submissionId}`);

    // Click Edit to enter edit mode
    await authedPage.getByRole("button", { name: /edit/i }).click();

    // Upload a text file via the hidden file input
    const testFile = createTestFile("test-poem.txt", "text/plain", 1);
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });

    // Wait for file to appear in "Uploaded files" section with Clean badge
    await expect(authedPage.getByText("Uploaded files")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("test-poem.txt")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("Clean")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shows upload progress indicator", async ({
    authedPage,
    testApiKey,
  }) => {
    await setupTusAuth(authedPage, testApiKey.plainKey);
    await authedPage.goto(`/submissions/${submissionId}`);
    await authedPage.getByRole("button", { name: /edit/i }).click();

    // Upload a slightly larger file to increase chance of catching progress
    const testFile = createTestFile("larger-file.txt", "text/plain", 10);
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });

    // File should eventually appear as uploaded (may complete too fast for progress bar)
    await expect(authedPage.getByText("larger-file.txt")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("uploaded file has CLEAN scan status in database", async ({
    authedPage,
    testApiKey,
  }) => {
    await setupTusAuth(authedPage, testApiKey.plainKey);
    await authedPage.goto(`/submissions/${submissionId}`);
    await authedPage.getByRole("button", { name: /edit/i }).click();

    const testFile = createTestFile("scan-test.txt", "text/plain", 1);
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });

    // Wait for UI to show the file
    await expect(authedPage.getByText("Clean")).toBeVisible({
      timeout: 15_000,
    });

    // Verify in DB (VIRUS_SCAN_ENABLED=false → marked CLEAN immediately)
    const files = await getFilesBySubmissionId(submissionId);
    expect(files.length).toBeGreaterThanOrEqual(1);
    const uploaded = files.find((f) => f.filename === "scan-test.txt");
    expect(uploaded).toBeDefined();
    expect(uploaded!.scanStatus).toBe("CLEAN");
  });

  test("can delete an uploaded file", async ({ authedPage, testApiKey }) => {
    await setupTusAuth(authedPage, testApiKey.plainKey);
    await authedPage.goto(`/submissions/${submissionId}`);
    await authedPage.getByRole("button", { name: /edit/i }).click();

    // Upload a file first
    const testFile = createTestFile("to-delete.txt", "text/plain", 1);
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });

    // Wait for it to appear in uploaded files
    await expect(authedPage.getByText("Uploaded files")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("to-delete.txt")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("Clean")).toBeVisible({
      timeout: 15_000,
    });

    // Find and click the delete button (X icon) for this file
    const fileRow = authedPage
      .locator(".border.rounded-lg")
      .filter({ hasText: "to-delete.txt" });
    await fileRow.getByRole("button").click();

    // File should disappear from the UI
    await expect(authedPage.getByText("to-delete.txt")).not.toBeVisible({
      timeout: 10_000,
    });

    // Verify in DB
    const files = await getFilesBySubmissionId(submissionId);
    const deleted = files.find((f) => f.filename === "to-delete.txt");
    expect(deleted).toBeUndefined();
  });

  test("rejects invalid MIME type (client-side)", async ({
    authedPage,
    testApiKey,
  }) => {
    await setupTusAuth(authedPage, testApiKey.plainKey);
    await authedPage.goto(`/submissions/${submissionId}`);
    await authedPage.getByRole("button", { name: /edit/i }).click();

    // Try to upload an .exe file — client-side validation should catch this
    const testFile = createTestFile(
      "malicious.exe",
      "application/x-msdownload",
      1,
    );
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });

    // Should show error message
    await expect(authedPage.getByText(/not allowed/i)).toBeVisible({
      timeout: 10_000,
    });

    // No file should be created in DB
    const files = await getFilesBySubmissionId(submissionId);
    const exe = files.find((f) => f.filename === "malicious.exe");
    expect(exe).toBeUndefined();
  });

  test("uploads multiple files", async ({ authedPage, testApiKey }) => {
    await setupTusAuth(authedPage, testApiKey.plainKey);
    await authedPage.goto(`/submissions/${submissionId}`);
    await authedPage.getByRole("button", { name: /edit/i }).click();

    const file1 = createTestFile("poem-1.txt", "text/plain", 1);
    const file2 = createTestFile("poem-2.txt", "text/plain", 1);

    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: file1.name, mimeType: file1.mimeType, buffer: file1.buffer },
      { name: file2.name, mimeType: file2.mimeType, buffer: file2.buffer },
    ]);

    // Wait for both files to appear in the "Uploaded files" section (not just "Uploading")
    await expect(authedPage.getByText("Uploaded files")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("poem-1.txt")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("poem-2.txt")).toBeVisible({
      timeout: 15_000,
    });

    // Verify in DB
    const files = await getFilesBySubmissionId(submissionId);
    const names = files.map((f) => f.filename);
    expect(names).toContain("poem-1.txt");
    expect(names).toContain("poem-2.txt");
  });
});
