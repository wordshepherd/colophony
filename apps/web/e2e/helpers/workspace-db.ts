/**
 * Workspace-specific database helpers for E2E test data setup/teardown.
 *
 * Uses the admin pool from ./db (bypasses RLS) to create and clean up
 * Writer Workspace entities: external submissions, correspondence.
 */

import { eq } from "drizzle-orm";
import { externalSubmissions, correspondence } from "@colophony/db";
import { getDb } from "./db";

// ── External Submissions ─────────────────────────────────────────

export async function createExternalSubmission(data: {
  userId: string;
  journalName: string;
  status?:
    | "draft"
    | "sent"
    | "in_review"
    | "hold"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "no_response"
    | "revise";
  manuscriptId?: string;
  sentAt?: Date;
  respondedAt?: Date;
  method?: string;
  notes?: string;
  importedFrom?: string;
}): Promise<{ id: string; journalName: string; status: string }> {
  const db = getDb();
  const [row] = await db
    .insert(externalSubmissions)
    .values({
      userId: data.userId,
      journalName: data.journalName,
      status: (data.status as "sent") ?? "sent",
      manuscriptId: data.manuscriptId ?? null,
      sentAt: data.sentAt ?? null,
      respondedAt: data.respondedAt ?? null,
      method: data.method ?? null,
      notes: data.notes ?? null,
      importedFrom: data.importedFrom ?? null,
    })
    .returning({
      id: externalSubmissions.id,
      journalName: externalSubmissions.journalName,
      status: externalSubmissions.status,
    });
  return row;
}

export async function deleteExternalSubmission(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(externalSubmissions)
    .where(eq(externalSubmissions.id, id))
    .catch(() => {});
}

// ── Correspondence ───────────────────────────────────────────────

export async function createCorrespondence(data: {
  userId: string;
  externalSubmissionId: string;
  direction: "inbound" | "outbound";
  channel?: "email" | "portal" | "in_app" | "other";
  sentAt: Date;
  subject?: string;
  body: string;
  senderName?: string;
  senderEmail?: string;
  source?: "manual" | "colophony";
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(correspondence)
    .values({
      userId: data.userId,
      externalSubmissionId: data.externalSubmissionId,
      direction: data.direction,
      channel: (data.channel as "email") ?? "email",
      sentAt: data.sentAt,
      subject: data.subject ?? null,
      body: data.body,
      senderName: data.senderName ?? null,
      senderEmail: data.senderEmail ?? null,
      source: data.source ?? "manual",
    })
    .returning({ id: correspondence.id });
  return row;
}

export async function deleteCorrespondence(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(correspondence)
    .where(eq(correspondence.id, id))
    .catch(() => {});
}

// ── Bulk Cleanup (reverse dependency order) ──────────────────────

export async function cleanupWorkspaceData(ids: {
  correspondence?: string[];
  externalSubmissions?: string[];
}): Promise<void> {
  // Delete correspondence first (depends on external submissions)
  for (const id of ids.correspondence ?? []) await deleteCorrespondence(id);
  for (const id of ids.externalSubmissions ?? [])
    await deleteExternalSubmission(id);
}
