/**
 * Upload-specific E2E test helpers.
 *
 * Provides utilities for file upload tests that interact with tusd + MinIO:
 * - Test file generation
 * - DB queries for file assertions
 * - tus request interception to swap Bearer→API key
 */

import type { Page } from "@playwright/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { files } from "@colophony/db";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://colophony:password@localhost:5432/colophony";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 5000,
    });
  }
  return pool;
}

function getDb() {
  return drizzle(getPool());
}

/**
 * Create a test file buffer for use with Playwright's `setInputFiles`.
 */
export function createTestFile(
  name: string,
  mimeType: string,
  sizeKB: number = 1,
): { name: string; mimeType: string; buffer: Buffer } {
  const buffer = Buffer.alloc(sizeKB * 1024, "a");
  return { name, mimeType, buffer };
}

/**
 * Query files associated with a manuscript version from the database.
 */
export async function getFilesByManuscriptVersionId(
  manuscriptVersionId: string,
): Promise<
  Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    scanStatus: string;
    storageKey: string;
  }>
> {
  const db = getDb();
  return db
    .select({
      id: files.id,
      filename: files.filename,
      mimeType: files.mimeType,
      size: files.size,
      scanStatus: files.scanStatus,
      storageKey: files.storageKey,
    })
    .from(files)
    .where(eq(files.manuscriptVersionId, manuscriptVersionId));
}

/**
 * Delete all files associated with a manuscript version (test cleanup).
 */
export async function deleteFilesByManuscriptVersionId(
  manuscriptVersionId: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(files)
    .where(eq(files.manuscriptVersionId, manuscriptVersionId))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * Disconnect the upload helper's DB pool.
 */
export async function disconnectUploadDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Set up tus request interception to swap Bearer token for API key.
 *
 * Mirrors the tRPC interception pattern in auth.ts — intercepts all
 * requests to tusd (localhost:1080) and replaces the Authorization
 * header with X-Api-Key.
 */
export async function setupTusAuth(page: Page, apiKey: string): Promise<void> {
  await page.route("**/localhost:1080/**", async (route) => {
    const request = route.request();
    const headers = { ...request.headers() };

    // Remove the fake OIDC Bearer token
    delete headers["authorization"];

    // Add the real API key
    headers["x-api-key"] = apiKey;

    await route.continue({ headers });
  });
}
