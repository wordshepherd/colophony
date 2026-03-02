import { journalDirectory, eq, inArray, type DrizzleDb } from '@colophony/db';
import { ilike } from 'drizzle-orm';
import type {
  JournalDirectorySearchInput,
  JournalDirectoryBatchMatchInput,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Service (read-only — app_user can only SELECT per RLS)
// ---------------------------------------------------------------------------

export const journalDirectoryService = {
  async search(tx: DrizzleDb, input: JournalDirectorySearchInput) {
    return tx
      .select({
        id: journalDirectory.id,
        name: journalDirectory.name,
        externalUrl: journalDirectory.externalUrl,
        colophonyDomain: journalDirectory.colophonyDomain,
      })
      .from(journalDirectory)
      .where(
        ilike(
          journalDirectory.normalizedName,
          `%${input.query.replace(/[\\%_]/g, '\\$&')}%`,
        ),
      )
      .limit(input.limit);
  },

  async batchMatchByName(
    tx: DrizzleDb,
    input: JournalDirectoryBatchMatchInput,
  ) {
    const normalized = input.names.map((n) => n.toLowerCase().trim());
    if (normalized.length === 0) return [];

    return tx
      .select({
        normalizedName: journalDirectory.normalizedName,
        id: journalDirectory.id,
        name: journalDirectory.name,
      })
      .from(journalDirectory)
      .where(inArray(journalDirectory.normalizedName, normalized));
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select({
        id: journalDirectory.id,
        name: journalDirectory.name,
        externalUrl: journalDirectory.externalUrl,
        colophonyDomain: journalDirectory.colophonyDomain,
      })
      .from(journalDirectory)
      .where(eq(journalDirectory.id, id))
      .limit(1);
    return row ?? null;
  },
};
