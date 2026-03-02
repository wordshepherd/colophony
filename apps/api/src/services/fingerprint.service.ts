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
 * Compute a content fingerprint using SHA-256 content hashes of actual file bytes.
 * Used for local sim-sub detection (higher accuracy than filename:size).
 */
export function computeContentFingerprint(
  title: string,
  contentText: string | null,
  fileContentHashes: string[],
): string {
  const sorted = [...fileContentHashes].sort();
  const input =
    normalizeText(title) +
    '\0' +
    normalizeText(contentText ?? '') +
    '\0' +
    sorted.join(',');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Compute a federation fingerprint using filename:size identifiers.
 * Used for cross-instance sim-sub detection (no file content shared).
 */
export function computeFederationFingerprint(
  title: string,
  contentText: string | null,
  fileIdentifiers: string[],
): string {
  const sorted = [...fileIdentifiers].sort();
  const input =
    normalizeText(title) +
    '\0' +
    normalizeText(contentText ?? '') +
    '\0' +
    sorted.join(',');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * @deprecated Use computeFederationFingerprint instead.
 * Kept temporarily for backwards compatibility during migration.
 */
export const computeFingerprint = computeFederationFingerprint;

// ---------------------------------------------------------------------------
// Return type for dual fingerprints
// ---------------------------------------------------------------------------

export interface DualFingerprint {
  contentFingerprint: string;
  federationFingerprint: string;
}

// ---------------------------------------------------------------------------
// Service (DB-dependent)
// ---------------------------------------------------------------------------

export const fingerprintService = {
  /**
   * Compute both fingerprints from manuscript version data and store them.
   *
   * Content fingerprint uses SHA-256 file content hashes (from ClamAV scan).
   * Federation fingerprint uses filename:size identifiers (cross-instance stable).
   * When contentHash is null (files scanned before this change), falls back
   * to filename:size for the content fingerprint too.
   */
  async computeAndStore(
    tx: DrizzleDb,
    manuscriptVersionId: string,
  ): Promise<DualFingerprint> {
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

    // Get CLEAN files with content hash + file identifiers
    const cleanFiles = await tx
      .select({
        filename: files.filename,
        size: files.size,
        contentHash: files.contentHash,
      })
      .from(files)
      .where(
        and(
          eq(files.manuscriptVersionId, manuscriptVersionId),
          eq(files.scanStatus, 'CLEAN'),
        ),
      );

    // Content fingerprint: prefer contentHash, fall back to filename:size
    const contentHashes = cleanFiles.map(
      (f) => f.contentHash ?? `${f.filename}:${f.size}`,
    );
    // Federation fingerprint: always filename:size (cross-instance stable)
    const fileIdentifiers = cleanFiles.map((f) => `${f.filename}:${f.size}`);

    // Check if there's a linked submission with content text
    const [linkedSubmission] = await tx
      .select({ content: submissions.content })
      .from(submissions)
      .where(eq(submissions.manuscriptVersionId, manuscriptVersionId))
      .limit(1);

    const contentText = linkedSubmission?.content ?? null;

    const contentFingerprint = computeContentFingerprint(
      manuscript.title,
      contentText,
      contentHashes,
    );
    const federationFingerprint = computeFederationFingerprint(
      manuscript.title,
      contentText,
      fileIdentifiers,
    );

    // Store both on the version
    await tx
      .update(manuscriptVersions)
      .set({ contentFingerprint, federationFingerprint })
      .where(eq(manuscriptVersions.id, manuscriptVersionId));

    return { contentFingerprint, federationFingerprint };
  },

  /**
   * Return stored fingerprints, or compute and store if absent.
   * Recomputes if either fingerprint is missing.
   */
  async getOrCompute(
    tx: DrizzleDb,
    manuscriptVersionId: string,
  ): Promise<DualFingerprint> {
    const [version] = await tx
      .select({
        contentFingerprint: manuscriptVersions.contentFingerprint,
        federationFingerprint: manuscriptVersions.federationFingerprint,
      })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, manuscriptVersionId))
      .limit(1);

    if (!version) {
      throw new FingerprintComputationError(
        `Manuscript version "${manuscriptVersionId}" not found`,
      );
    }

    if (version.contentFingerprint && version.federationFingerprint) {
      return {
        contentFingerprint: version.contentFingerprint,
        federationFingerprint: version.federationFingerprint,
      };
    }

    return this.computeAndStore(tx, manuscriptVersionId);
  },
};
