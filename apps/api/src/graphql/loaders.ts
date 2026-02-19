import DataLoader from 'dataloader';
import {
  submissionFiles,
  users,
  organizationMembers,
  inArray,
  type DrizzleDb,
} from '@colophony/db';
import type { SubmissionFile, User, OrganizationMember } from '@colophony/db';

export interface Loaders {
  submissionFiles: DataLoader<string, SubmissionFile[]>;
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
