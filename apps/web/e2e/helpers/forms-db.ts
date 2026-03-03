/**
 * Forms-specific database helpers for E2E test data setup/teardown.
 *
 * Uses the admin pool from ./db (bypasses RLS) to create and clean up
 * form entities: definitions, fields, pages.
 */

import { eq } from "drizzle-orm";
import { formDefinitions, formFields, formPages } from "@colophony/db";
import { getDb } from "./db";

// ── Form Definitions ─────────────────────────────────────────────

export async function createFormDefinition(data: {
  orgId: string;
  name: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdBy: string;
}): Promise<{ id: string; name: string; status: string }> {
  const db = getDb();
  const [row] = await db
    .insert(formDefinitions)
    .values({
      organizationId: data.orgId,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? "DRAFT",
      createdBy: data.createdBy,
    })
    .returning({
      id: formDefinitions.id,
      name: formDefinitions.name,
      status: formDefinitions.status,
    });
  return row;
}

export async function getFormDefinition(
  id: string,
): Promise<{ id: string; name: string; status: string } | undefined> {
  const db = getDb();
  const [row] = await db
    .select({
      id: formDefinitions.id,
      name: formDefinitions.name,
      status: formDefinitions.status,
    })
    .from(formDefinitions)
    .where(eq(formDefinitions.id, id))
    .limit(1);
  return row;
}

export async function publishFormDefinition(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(formDefinitions)
    .set({ status: "PUBLISHED", publishedAt: new Date() })
    .where(eq(formDefinitions.id, id));
}

export async function deleteFormDefinition(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(formDefinitions)
    .where(eq(formDefinitions.id, id))
    .catch(() => {});
}

// ── Form Fields ──────────────────────────────────────────────────

export async function createFormField(data: {
  formDefinitionId: string;
  fieldKey: string;
  fieldType:
    | "text"
    | "textarea"
    | "rich_text"
    | "number"
    | "email"
    | "url"
    | "date"
    | "select"
    | "multi_select"
    | "radio"
    | "checkbox"
    | "checkbox_group"
    | "file_upload"
    | "section_header"
    | "info_text";
  label: string;
  sortOrder: number;
  required?: boolean;
  config?: Record<string, unknown>;
  pageId?: string;
}): Promise<{ id: string; fieldKey: string }> {
  const db = getDb();
  const [row] = await db
    .insert(formFields)
    .values({
      formDefinitionId: data.formDefinitionId,
      fieldKey: data.fieldKey,
      fieldType: data.fieldType,
      label: data.label,
      sortOrder: data.sortOrder,
      required: data.required ?? false,
      config: data.config ?? {},
      pageId: data.pageId ?? null,
    })
    .returning({
      id: formFields.id,
      fieldKey: formFields.fieldKey,
    });
  return row;
}

// ── Form Pages ───────────────────────────────────────────────────

export async function createFormPage(data: {
  formDefinitionId: string;
  title: string;
  sortOrder: number;
}): Promise<{ id: string; title: string }> {
  const db = getDb();
  const [row] = await db
    .insert(formPages)
    .values({
      formDefinitionId: data.formDefinitionId,
      title: data.title,
      sortOrder: data.sortOrder,
    })
    .returning({
      id: formPages.id,
      title: formPages.title,
    });
  return row;
}
