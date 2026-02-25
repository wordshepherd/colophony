import crypto from 'node:crypto';
import {
  manuscriptVersions,
  manuscripts,
  files,
  submissions,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class FingerprintComputationError extends Error {
  override name = 'FingerprintComputationError' as const;
  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Pure functions (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Normalize text for fingerprinting: lowercase, collapse whitespace, trim.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Compute a SHA-256 hex fingerprint from title, optional content text,
 * and file hashes (sorted for determinism).
 */
export function computeFingerprint(
  title: string,
  contentText: string | null,
  fileHashes: string[],
): string {
  const sorted = [...fileHashes].sort();
  const input =
    normalizeText(title) +
    '\0' +
    normalizeText(contentText ?? '') +
    '\0' +
    sorted.join(',');
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Service (DB-dependent)
// ---------------------------------------------------------------------------

export const fingerprintService = {
  /**
   * Compute fingerprint from manuscript version data and store it.
   *
   * Uses the manuscript title, submission content (if linked), and
   * storage keys of CLEAN files as the fingerprint inputs.
   */
  async computeAndStore(
    tx: DrizzleDb,
    manuscriptVersionId: string,
  ): Promise<string> {
    // Load version + manuscript title
    const [version] = await tx
      .select({
        id: manuscriptVersions.id,
        manuscriptId: manuscriptVersions.manuscriptId,
      })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, manuscriptVersionId))
      .limit(1);

    if (!version) {
      throw new FingerprintComputationError(
        `Manuscript version "${manuscriptVersionId}" not found`,
      );
    }

    const [manuscript] = await tx
      .select({ title: manuscripts.title })
      .from(manuscripts)
      .where(eq(manuscripts.id, version.manuscriptId))
      .limit(1);

    if (!manuscript) {
      throw new FingerprintComputationError(
        `Manuscript for version "${manuscriptVersionId}" not found`,
      );
    }

    // Get CLEAN file identifiers for fingerprinting.
    // Uses filename + size (not storageKey) for cross-instance stability:
    // the same file uploaded to different instances has the same name/size
    // but different storage keys.
    const cleanFiles = await tx
      .select({
        filename: files.filename,
        size: files.size,
      })
      .from(files)
      .where(
        and(
          eq(files.manuscriptVersionId, manuscriptVersionId),
          eq(files.scanStatus, 'CLEAN'),
        ),
      );

    const fileHashes = cleanFiles.map((f) => `${f.filename}:${f.size}`);

    // Check if there's a linked submission with content text
    const [linkedSubmission] = await tx
      .select({ content: submissions.content })
      .from(submissions)
      .where(eq(submissions.manuscriptVersionId, manuscriptVersionId))
      .limit(1);

    const contentText = linkedSubmission?.content ?? null;

    const fingerprint = computeFingerprint(
      manuscript.title,
      contentText,
      fileHashes,
    );

    // Store on the version
    await tx
      .update(manuscriptVersions)
      .set({ contentFingerprint: fingerprint })
      .where(eq(manuscriptVersions.id, manuscriptVersionId));

    return fingerprint;
  },

  /**
   * Return the stored fingerprint, or compute and store it if absent.
   */
  async getOrCompute(
    tx: DrizzleDb,
    manuscriptVersionId: string,
  ): Promise<string> {
    const [version] = await tx
      .select({ contentFingerprint: manuscriptVersions.contentFingerprint })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, manuscriptVersionId))
      .limit(1);

    if (!version) {
      throw new FingerprintComputationError(
        `Manuscript version "${manuscriptVersionId}" not found`,
      );
    }

    if (version.contentFingerprint) {
      return version.contentFingerprint;
    }

    return this.computeAndStore(tx, manuscriptVersionId);
  },
};
