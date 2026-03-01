import { journalDirectory, eq, type DrizzleDb } from '@colophony/db';
import { ilike } from 'drizzle-orm';
import type { JournalDirectorySearchInput } from '@colophony/types';

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
          `%${input.query.replace(/[%_]/g, '\\$&')}%`,
        ),
      )
      .limit(input.limit);
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
