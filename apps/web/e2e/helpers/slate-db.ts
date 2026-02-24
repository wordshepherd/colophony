/**
 * Slate-specific database helpers for E2E test data setup/teardown.
 *
 * Uses the admin pool from ./db (bypasses RLS) to create and clean up
 * Slate entities: publications, pipeline items, issues, contracts,
 * contract templates, CMS connections.
 */

import { eq } from "drizzle-orm";
import {
  publications,
  pipelineItems,
  contractTemplates,
  contracts,
  issues,
  issueSections,
  issueItems,
  cmsConnections,
} from "@colophony/db";
import { getDb } from "./db";

// ── Publications ──────────────────────────────────────────────────

export async function createPublication(data: {
  orgId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<{ id: string; name: string; slug: string }> {
  const db = getDb();
  const [row] = await db
    .insert(publications)
    .values({
      organizationId: data.orgId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      status: "ACTIVE",
    })
    .returning({
      id: publications.id,
      name: publications.name,
      slug: publications.slug,
    });
  return row;
}

export async function deletePublication(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(publications)
    .where(eq(publications.id, id))
    .catch(() => {});
}

// ── Pipeline Items ────────────────────────────────────────────────

export async function createPipelineItem(data: {
  orgId: string;
  submissionId: string;
  publicationId?: string;
  stage?: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(pipelineItems)
    .values({
      organizationId: data.orgId,
      submissionId: data.submissionId,
      publicationId: data.publicationId ?? null,
      stage: (data.stage as "COPYEDIT_PENDING") ?? "COPYEDIT_PENDING",
    })
    .returning({ id: pipelineItems.id });
  return row;
}

export async function deletePipelineItem(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(pipelineItems)
    .where(eq(pipelineItems.id, id))
    .catch(() => {});
}

// ── Contract Templates ────────────────────────────────────────────

export async function createContractTemplate(data: {
  orgId: string;
  name: string;
  body: string;
  isDefault?: boolean;
  mergeFields?: Array<{
    key: string;
    label: string;
    source: "auto" | "manual";
    defaultValue?: string;
  }>;
}): Promise<{ id: string; name: string }> {
  const db = getDb();
  const [row] = await db
    .insert(contractTemplates)
    .values({
      organizationId: data.orgId,
      name: data.name,
      body: data.body,
      isDefault: data.isDefault ?? false,
      mergeFields: data.mergeFields ?? null,
    })
    .returning({
      id: contractTemplates.id,
      name: contractTemplates.name,
    });
  return row;
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(contractTemplates)
    .where(eq(contractTemplates.id, id))
    .catch(() => {});
}

// ── Contracts ─────────────────────────────────────────────────────

export async function createContract(data: {
  orgId: string;
  pipelineItemId: string;
  contractTemplateId?: string;
  renderedBody: string;
  status?: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(contracts)
    .values({
      organizationId: data.orgId,
      pipelineItemId: data.pipelineItemId,
      contractTemplateId: data.contractTemplateId ?? null,
      renderedBody: data.renderedBody,
      status: (data.status as "DRAFT") ?? "DRAFT",
    })
    .returning({ id: contracts.id });
  return row;
}

export async function deleteContract(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(contracts)
    .where(eq(contracts.id, id))
    .catch(() => {});
}

// ── Issues ────────────────────────────────────────────────────────

export async function createIssue(data: {
  orgId: string;
  publicationId: string;
  title: string;
  volume?: number;
  issueNumber?: number;
  status?: string;
  publicationDate?: Date;
}): Promise<{ id: string; title: string }> {
  const db = getDb();
  const [row] = await db
    .insert(issues)
    .values({
      organizationId: data.orgId,
      publicationId: data.publicationId,
      title: data.title,
      volume: data.volume ?? null,
      issueNumber: data.issueNumber ?? null,
      status: (data.status as "PLANNING") ?? "PLANNING",
      publicationDate: data.publicationDate ?? null,
    })
    .returning({
      id: issues.id,
      title: issues.title,
    });
  return row;
}

export async function deleteIssue(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(issues)
    .where(eq(issues.id, id))
    .catch(() => {});
}

// ── Issue Sections ────────────────────────────────────────────────

export async function createIssueSection(data: {
  issueId: string;
  title: string;
  sortOrder?: number;
}): Promise<{ id: string; title: string }> {
  const db = getDb();
  const [row] = await db
    .insert(issueSections)
    .values({
      issueId: data.issueId,
      title: data.title,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning({
      id: issueSections.id,
      title: issueSections.title,
    });
  return row;
}

export async function deleteIssueSection(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(issueSections)
    .where(eq(issueSections.id, id))
    .catch(() => {});
}

// ── Issue Items ───────────────────────────────────────────────────

export async function createIssueItem(data: {
  issueId: string;
  pipelineItemId: string;
  issueSectionId?: string;
  sortOrder?: number;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(issueItems)
    .values({
      issueId: data.issueId,
      pipelineItemId: data.pipelineItemId,
      issueSectionId: data.issueSectionId ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning({ id: issueItems.id });
  return row;
}

export async function deleteIssueItem(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(issueItems)
    .where(eq(issueItems.id, id))
    .catch(() => {});
}

// ── CMS Connections ───────────────────────────────────────────────

export async function createCmsConnection(data: {
  orgId: string;
  name: string;
  adapterType: "WORDPRESS" | "GHOST";
  config: Record<string, unknown>;
  publicationId?: string;
  isActive?: boolean;
}): Promise<{ id: string; name: string }> {
  const db = getDb();
  const [row] = await db
    .insert(cmsConnections)
    .values({
      organizationId: data.orgId,
      name: data.name,
      adapterType: data.adapterType,
      config: data.config,
      publicationId: data.publicationId ?? null,
      isActive: data.isActive ?? true,
    })
    .returning({
      id: cmsConnections.id,
      name: cmsConnections.name,
    });
  return row;
}

export async function deleteCmsConnection(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(cmsConnections)
    .where(eq(cmsConnections.id, id))
    .catch(() => {});
}

// ── Bulk Cleanup (reverse dependency order) ───────────────────────

export async function cleanupSlateData(ids: {
  cmsConnections?: string[];
  issueItems?: string[];
  issueSections?: string[];
  issues?: string[];
  contracts?: string[];
  contractTemplates?: string[];
  pipelineItems?: string[];
  publications?: string[];
}): Promise<void> {
  // Delete in reverse dependency order
  for (const id of ids.cmsConnections ?? []) await deleteCmsConnection(id);
  for (const id of ids.issueItems ?? []) await deleteIssueItem(id);
  for (const id of ids.issueSections ?? []) await deleteIssueSection(id);
  for (const id of ids.issues ?? []) await deleteIssue(id);
  for (const id of ids.contracts ?? []) await deleteContract(id);
  for (const id of ids.contractTemplates ?? [])
    await deleteContractTemplate(id);
  for (const id of ids.pipelineItems ?? []) await deletePipelineItem(id);
  for (const id of ids.publications ?? []) await deletePublication(id);
}
