import DataLoader from 'dataloader';
import { asc } from 'drizzle-orm';
import {
  submissionFiles,
  formFields,
  formPages,
  users,
  organizationMembers,
  inArray,
  type DrizzleDb,
} from '@colophony/db';
import type {
  SubmissionFile,
  FormField,
  FormPage,
  User,
  OrganizationMember,
} from '@colophony/db';

export interface Loaders {
  submissionFiles: DataLoader<string, SubmissionFile[]>;
  formFields: DataLoader<string, FormField[]>;
  formPages: DataLoader<string, FormPage[]>;
  user: DataLoader<string, User | null>;
  orgMembers: DataLoader<string, OrganizationMember[]>;
}

/**
 * Create request-scoped DataLoaders.
 * Each loader batches queries within a single tick using the RLS transaction.
 */
export function createLoaders(dbTx: DrizzleDb | null): Loaders {
  return {
    /**
     * Batch-load submission files by submission ID.
     * Returns an array of files per submission (may be empty).
     */
    submissionFiles: new DataLoader<string, SubmissionFile[]>(
      async (submissionIds) => {
        if (!dbTx) return submissionIds.map(() => []);

        const rows = await dbTx
          .select()
          .from(submissionFiles)
          .where(inArray(submissionFiles.submissionId, [...submissionIds]));

        const grouped = new Map<string, SubmissionFile[]>();
        for (const row of rows) {
          const list = grouped.get(row.submissionId) ?? [];
          list.push(row);
          grouped.set(row.submissionId, list);
        }

        return submissionIds.map((id) => grouped.get(id) ?? []);
      },
    ),

    /**
     * Batch-load form fields by form definition ID.
     * Returns an array of fields per form (may be empty), ordered by sortOrder.
     */
    formFields: new DataLoader<string, FormField[]>(async (formIds) => {
      if (!dbTx) return formIds.map(() => []);

      const rows = await dbTx
        .select()
        .from(formFields)
        .where(inArray(formFields.formDefinitionId, [...formIds]))
        .orderBy(asc(formFields.sortOrder));

      const grouped = new Map<string, FormField[]>();
      for (const row of rows) {
        const list = grouped.get(row.formDefinitionId) ?? [];
        list.push(row);
        grouped.set(row.formDefinitionId, list);
      }

      return formIds.map((id) => grouped.get(id) ?? []);
    }),

    /**
     * Batch-load form pages by form definition ID.
     * Returns an array of pages per form (may be empty), ordered by sortOrder.
     */
    formPages: new DataLoader<string, FormPage[]>(async (formIds) => {
      if (!dbTx) return formIds.map(() => []);

      const rows = await dbTx
        .select()
        .from(formPages)
        .where(inArray(formPages.formDefinitionId, [...formIds]))
        .orderBy(asc(formPages.sortOrder));

      const grouped = new Map<string, FormPage[]>();
      for (const row of rows) {
        const list = grouped.get(row.formDefinitionId) ?? [];
        list.push(row);
        grouped.set(row.formDefinitionId, list);
      }

      return formIds.map((id) => grouped.get(id) ?? []);
    }),

    /**
     * Batch-load users by user ID.
     * Returns the user or null if not found.
     */
    user: new DataLoader<string, User | null>(async (userIds) => {
      if (!dbTx) return userIds.map(() => null);

      const rows = await dbTx
        .select()
        .from(users)
        .where(inArray(users.id, [...userIds]));

      const byId = new Map<string, User>();
      for (const row of rows) {
        byId.set(row.id, row);
      }

      return userIds.map((id) => byId.get(id) ?? null);
    }),

    /**
     * Batch-load org members by organization ID.
     * Returns an array of members per org (may be empty).
     */
    orgMembers: new DataLoader<string, OrganizationMember[]>(async (orgIds) => {
      if (!dbTx) return orgIds.map(() => []);

      const rows = await dbTx
        .select()
        .from(organizationMembers)
        .where(inArray(organizationMembers.organizationId, [...orgIds]));

      const grouped = new Map<string, OrganizationMember[]>();
      for (const row of rows) {
        const list = grouped.get(row.organizationId) ?? [];
        list.push(row);
        grouped.set(row.organizationId, list);
      }

      return orgIds.map((id) => grouped.get(id) ?? []);
    }),
  };
}
