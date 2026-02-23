/**
 * Database helpers for embed E2E test data setup/teardown.
 *
 * Reuses the shared admin pool from db.ts (no second pool).
 * All operations bypass RLS via the admin connection.
 */

import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import {
  embedTokens,
  formDefinitions,
  formPages,
  formFields,
  submissions,
  submissionPeriods,
  users,
} from "@colophony/db";
import { getDb } from "./db";

const EMBED_TOKEN_PREFIX = "col_emb_";

/**
 * Create a PUBLISHED form definition with pages and fields.
 */
export async function createFormDefinition(data: {
  orgId: string;
  createdBy: string;
  name?: string;
  pages?: Array<{
    title: string;
    description?: string;
    sortOrder: number;
  }>;
  fields?: Array<{
    fieldKey: string;
    fieldType: string;
    label: string;
    description?: string;
    placeholder?: string;
    required?: boolean;
    sortOrder?: number;
    config?: Record<string, unknown>;
    pageIndex?: number; // index into pages array for page assignment
  }>;
}): Promise<{ id: string; pageIds: string[]; fieldIds: string[] }> {
  const db = getDb();

  const [form] = await db
    .insert(formDefinitions)
    .values({
      organizationId: data.orgId,
      createdBy: data.createdBy,
      name: data.name ?? `E2E Test Form ${Date.now()}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
    })
    .returning({ id: formDefinitions.id });

  // Create pages
  const pageIds: string[] = [];
  if (data.pages?.length) {
    for (const page of data.pages) {
      const [row] = await db
        .insert(formPages)
        .values({
          formDefinitionId: form.id,
          title: page.title,
          description: page.description ?? null,
          sortOrder: page.sortOrder,
        })
        .returning({ id: formPages.id });
      pageIds.push(row.id);
    }
  }

  // Create fields
  const fieldIds: string[] = [];
  if (data.fields?.length) {
    for (const field of data.fields) {
      const pageId =
        field.pageIndex !== undefined ? pageIds[field.pageIndex] : null;
      const [row] = await db
        .insert(formFields)
        .values({
          formDefinitionId: form.id,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType as "text",
          label: field.label,
          description: field.description ?? null,
          placeholder: field.placeholder ?? null,
          required: field.required ?? false,
          sortOrder: field.sortOrder ?? 0,
          config: field.config ?? {},
          pageId: pageId ?? undefined,
        })
        .returning({ id: formFields.id });
      fieldIds.push(row.id);
    }
  }

  return { id: form.id, pageIds, fieldIds };
}

/**
 * Create an embed token (generates col_emb_ prefixed token, stores SHA-256 hash).
 * Returns the plain token for use in test navigation.
 */
export async function createEmbedToken(data: {
  orgId: string;
  submissionPeriodId: string;
  createdBy: string;
  active?: boolean;
  expiresAt?: Date | null;
}): Promise<{ id: string; plainToken: string }> {
  const db = getDb();

  const randomPart = randomBytes(16).toString("hex");
  const plainToken = `${EMBED_TOKEN_PREFIX}${randomPart}`;
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");

  const [row] = await db
    .insert(embedTokens)
    .values({
      organizationId: data.orgId,
      submissionPeriodId: data.submissionPeriodId,
      tokenHash,
      tokenPrefix: EMBED_TOKEN_PREFIX,
      active: data.active ?? true,
      createdBy: data.createdBy,
      expiresAt: data.expiresAt ?? null,
    })
    .returning({ id: embedTokens.id });

  return { id: row.id, plainToken };
}

/**
 * Link a form definition to a submission period.
 */
export async function linkFormToPeriod(
  periodId: string,
  formDefinitionId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(submissionPeriods)
    .set({ formDefinitionId })
    .where(eq(submissionPeriods.id, periodId));
}

/**
 * Unlink form from a submission period (restore null).
 */
export async function unlinkFormFromPeriod(periodId: string): Promise<void> {
  const db = getDb();
  await db
    .update(submissionPeriods)
    .set({ formDefinitionId: null })
    .where(eq(submissionPeriods.id, periodId));
}

/**
 * Delete a form definition (cascades to pages and fields).
 */
export async function deleteFormDefinition(formId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(formDefinitions)
    .where(eq(formDefinitions.id, formId))
    .catch(() => {});
}

/**
 * Delete an embed token by ID.
 */
export async function deleteEmbedToken(tokenId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(embedTokens)
    .where(eq(embedTokens.id, tokenId))
    .catch(() => {});
}

/**
 * Delete submissions by guest user email.
 * Finds the guest user, then deletes their submissions.
 */
export async function deleteSubmissionsByEmail(email: string): Promise<void> {
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user) {
    await db
      .delete(submissions)
      .where(eq(submissions.submitterId, user.id))
      .catch(() => {});
  }
}

/**
 * Delete a guest user by email.
 */
export async function deleteGuestUser(email: string): Promise<void> {
  const db = getDb();
  await db
    .delete(users)
    .where(eq(users.email, email))
    .catch(() => {});
}
