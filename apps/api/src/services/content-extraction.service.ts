import {
  manuscriptVersions,
  manuscripts,
  eq,
  and,
  type DrizzleDb,
  sql,
} from '@colophony/db';
import type {
  ProseMirrorDoc,
  GenreHint,
  ContentExtractionStatus,
} from '@colophony/types';

const GENRE_TO_HINT: Record<string, GenreHint> = {
  poetry: 'poetry',
  fiction: 'prose',
  creative_nonfiction: 'creative_nonfiction',
  nonfiction: 'prose',
  drama: 'prose',
  translation: 'prose',
  visual_art: 'prose',
  comics: 'prose',
  audio: 'prose',
  other: 'prose',
};

/**
 * Defense-in-depth: subquery filter that proves the manuscript version
 * belongs to a manuscript owned by the given user. Applied alongside RLS.
 */
function ownershipFilter(manuscriptVersionId: string, userId: string) {
  return and(
    eq(manuscriptVersions.id, manuscriptVersionId),
    sql`${manuscriptVersions.manuscriptId} IN (
      SELECT id FROM manuscripts WHERE owner_id = ${userId}::uuid
    )`,
  );
}

export const contentExtractionService = {
  /**
   * Get extraction status for a manuscript version.
   * Defense-in-depth: verifies ownership via manuscripts.owner_id.
   */
  async getStatus(
    tx: DrizzleDb,
    manuscriptVersionId: string,
    userId: string,
  ): Promise<ContentExtractionStatus | null> {
    const [row] = await tx
      .select({ status: manuscriptVersions.contentExtractionStatus })
      .from(manuscriptVersions)
      .where(ownershipFilter(manuscriptVersionId, userId))
      .limit(1);
    return (row?.status as ContentExtractionStatus) ?? null;
  },

  /**
   * Update extraction status.
   * Defense-in-depth: verifies ownership via manuscripts.owner_id.
   */
  async updateStatus(
    tx: DrizzleDb,
    manuscriptVersionId: string,
    userId: string,
    status: ContentExtractionStatus,
  ): Promise<void> {
    await tx
      .update(manuscriptVersions)
      .set({ contentExtractionStatus: status })
      .where(ownershipFilter(manuscriptVersionId, userId));
  },

  /**
   * Store extracted content as ProseMirror JSON.
   * Sets content, contentFormat, and status to COMPLETE.
   * Defense-in-depth: verifies ownership via manuscripts.owner_id.
   */
  async storeContent(
    tx: DrizzleDb,
    manuscriptVersionId: string,
    userId: string,
    content: ProseMirrorDoc,
    contentFormat: string = 'prosemirror_v1',
  ): Promise<void> {
    await tx
      .update(manuscriptVersions)
      .set({
        content,
        contentFormat,
        contentExtractionStatus: 'COMPLETE',
      })
      .where(ownershipFilter(manuscriptVersionId, userId));
  },

  /**
   * Get genre hint for a manuscript version by joining to manuscripts table.
   * Returns the mapped GenreHint or null if no genre is set.
   * Defense-in-depth: verifies ownership via manuscripts.owner_id.
   */
  async getGenreHintForVersion(
    tx: DrizzleDb,
    manuscriptVersionId: string,
    userId: string,
  ): Promise<GenreHint | null> {
    const [row] = await tx
      .select({ genre: manuscripts.genre })
      .from(manuscriptVersions)
      .innerJoin(
        manuscripts,
        and(
          eq(manuscriptVersions.manuscriptId, manuscripts.id),
          eq(manuscripts.ownerId, userId),
        ),
      )
      .where(eq(manuscriptVersions.id, manuscriptVersionId))
      .limit(1);

    if (!row?.genre) return null;

    const primary =
      typeof row.genre === 'object' && row.genre !== null
        ? (row.genre as { primary?: string }).primary
        : undefined;

    return primary ? (GENRE_TO_HINT[primary] ?? 'prose') : null;
  },
};
