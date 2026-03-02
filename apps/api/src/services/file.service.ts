import {
  files,
  manuscripts,
  manuscriptVersions,
  eq,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { asc, count } from 'drizzle-orm';
import type { ScanStatus } from '@colophony/types';
import {
  MAX_FILES_PER_MANUSCRIPT_VERSION,
  MAX_TOTAL_UPLOAD_SIZE,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import type { ServiceContext, UserServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class FileNotFoundError extends Error {
  constructor(id: string) {
    super(`File "${id}" not found`);
    this.name = 'FileNotFoundError';
  }
}

export class FileLimitExceededError extends Error {
  constructor() {
    super(
      `Maximum of ${MAX_FILES_PER_MANUSCRIPT_VERSION} files per manuscript version exceeded`,
    );
    this.name = 'FileLimitExceededError';
  }
}

export class TotalSizeLimitExceededError extends Error {
  constructor() {
    super(
      `Total upload size exceeds maximum of ${MAX_TOTAL_UPLOAD_SIZE} bytes`,
    );
    this.name = 'TotalSizeLimitExceededError';
  }
}

export class FileSizeLimitExceededError extends Error {
  constructor() {
    super(`File size exceeds maximum of ${MAX_FILE_SIZE} bytes`);
    this.name = 'FileSizeLimitExceededError';
  }
}

export class InvalidMimeTypeError extends Error {
  constructor(mimeType: string) {
    super(`MIME type "${mimeType}" is not allowed`);
    this.name = 'InvalidMimeTypeError';
  }
}

export class FileNotCleanError extends Error {
  constructor(fileId: string, scanStatus: string) {
    super(
      `File "${fileId}" has scan status "${scanStatus}" — download blocked`,
    );
    this.name = 'FileNotCleanError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const fileService = {
  async listByManuscriptVersion(tx: DrizzleDb, manuscriptVersionId: string) {
    return tx
      .select()
      .from(files)
      .where(eq(files.manuscriptVersionId, manuscriptVersionId))
      .orderBy(asc(files.uploadedAt));
  },

  async getById(tx: DrizzleDb, fileId: string) {
    const [file] = await tx
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);
    return file ?? null;
  },

  async getByStorageKey(tx: DrizzleDb, storageKey: string) {
    const [file] = await tx
      .select()
      .from(files)
      .where(eq(files.storageKey, storageKey))
      .limit(1);
    return file ?? null;
  },

  async create(
    tx: DrizzleDb,
    input: {
      manuscriptVersionId: string;
      filename: string;
      mimeType: string;
      size: number;
      storageKey: string;
    },
  ) {
    const [file] = await tx
      .insert(files)
      .values({
        manuscriptVersionId: input.manuscriptVersionId,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        storageKey: input.storageKey,
        scanStatus: 'PENDING',
      })
      .returning();
    return file;
  },

  async updateScanStatus(
    tx: DrizzleDb,
    fileId: string,
    scanStatus: ScanStatus,
  ) {
    const [updated] = await tx
      .update(files)
      .set({
        scanStatus,
        scannedAt: scanStatus === 'PENDING' ? null : sql`now()`,
      })
      .where(eq(files.id, fileId))
      .returning();
    return updated ?? null;
  },

  async updateContentHash(
    tx: DrizzleDb,
    fileId: string,
    contentHash: string,
  ): Promise<void> {
    await tx.update(files).set({ contentHash }).where(eq(files.id, fileId));
  },

  async delete(tx: DrizzleDb, fileId: string) {
    const [deleted] = await tx
      .delete(files)
      .where(eq(files.id, fileId))
      .returning();
    return deleted ?? null;
  },

  async countByManuscriptVersion(tx: DrizzleDb, manuscriptVersionId: string) {
    const [result] = await tx
      .select({ count: count() })
      .from(files)
      .where(eq(files.manuscriptVersionId, manuscriptVersionId));
    return result?.count ?? 0;
  },

  async totalSizeByManuscriptVersion(
    tx: DrizzleDb,
    manuscriptVersionId: string,
  ) {
    const [result] = await tx
      .select({
        total: sql<number>`coalesce(sum(${files.size}), 0)`,
      })
      .from(files)
      .where(eq(files.manuscriptVersionId, manuscriptVersionId));
    return Number(result?.total ?? 0);
  },

  validateMimeType(mimeType: string): void {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new InvalidMimeTypeError(mimeType);
    }
  },

  validateFileSize(size: number): void {
    if (size > MAX_FILE_SIZE) {
      throw new FileSizeLimitExceededError();
    }
  },

  async validateLimits(
    tx: DrizzleDb,
    manuscriptVersionId: string,
    newFileSize: number,
  ): Promise<void> {
    const fileCount = await fileService.countByManuscriptVersion(
      tx,
      manuscriptVersionId,
    );
    if (fileCount >= MAX_FILES_PER_MANUSCRIPT_VERSION) {
      throw new FileLimitExceededError();
    }

    const totalSize = await fileService.totalSizeByManuscriptVersion(
      tx,
      manuscriptVersionId,
    );
    if (totalSize + newFileSize > MAX_TOTAL_UPLOAD_SIZE) {
      throw new TotalSizeLimitExceededError();
    }
  },

  // ---------------------------------------------------------------------------
  // S3-integrated methods
  // ---------------------------------------------------------------------------

  async getDownloadUrl(
    tx: DrizzleDb,
    fileId: string,
    storage: S3StorageAdapter,
  ): Promise<{ url: string; filename: string; mimeType: string } | null> {
    const file = await fileService.getById(tx, fileId);
    if (!file) return null;

    if (file.scanStatus !== 'CLEAN') {
      throw new FileNotCleanError(fileId, file.scanStatus);
    }

    const url = await storage.getSignedUrlFromBucket(
      storage.defaultBucket,
      file.storageKey,
    );

    return { url, filename: file.filename, mimeType: file.mimeType };
  },

  async deleteWithS3(tx: DrizzleDb, fileId: string, storage: S3StorageAdapter) {
    const deleted = await fileService.delete(tx, fileId);
    if (!deleted) return null;

    const targetBucket =
      deleted.scanStatus === 'CLEAN'
        ? storage.defaultBucket
        : storage.quarantineBucket;
    await storage.deleteFromBucket(targetBucket, deleted.storageKey);

    return deleted;
  },

  // ---------------------------------------------------------------------------
  // Access-aware methods
  // ---------------------------------------------------------------------------

  /**
   * List files for a manuscript version — owner access check via RLS.
   * For org-context access (editors viewing submission files), use
   * listByManuscriptVersion directly (org RLS policy handles access).
   */
  async listByManuscriptVersionWithAccess(
    ctx: UserServiceContext,
    manuscriptVersionId: string,
  ) {
    return fileService.listByManuscriptVersion(ctx.tx, manuscriptVersionId);
  },

  /**
   * Get a presigned download URL — requires CLEAN status.
   */
  async getDownloadUrlWithAccess(
    svc: ServiceContext | UserServiceContext,
    fileId: string,
    storage: S3StorageAdapter,
  ) {
    const file = await fileService.getById(svc.tx, fileId);
    if (!file) throw new FileNotFoundError(fileId);

    if (file.scanStatus !== 'CLEAN') {
      throw new FileNotCleanError(fileId, file.scanStatus);
    }

    const url = await storage.getSignedUrlFromBucket(
      storage.defaultBucket,
      file.storageKey,
    );
    return { url, filename: file.filename, mimeType: file.mimeType };
  },

  /**
   * Delete a file — manuscript owner only, with audit + S3 cleanup.
   */
  async deleteAsOwner(
    svc: UserServiceContext,
    fileId: string,
    storage: S3StorageAdapter,
  ) {
    const file = await fileService.getById(svc.tx, fileId);
    if (!file) throw new FileNotFoundError(fileId);

    // Verify ownership via manuscript chain
    const [version] = await svc.tx
      .select({ manuscriptId: manuscriptVersions.manuscriptId })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, file.manuscriptVersionId))
      .limit(1);

    if (!version) throw new FileNotFoundError(fileId);

    const [manuscript] = await svc.tx
      .select({ ownerId: manuscripts.ownerId })
      .from(manuscripts)
      .where(eq(manuscripts.id, version.manuscriptId))
      .limit(1);

    if (!manuscript || manuscript.ownerId !== svc.userId) {
      throw new ForbiddenError('Only the manuscript owner can delete files');
    }

    const deleted = await fileService.delete(svc.tx, fileId);
    if (!deleted) throw new FileNotFoundError(fileId);

    await svc.audit({
      action: AuditActions.FILE_DELETED,
      resource: AuditResources.FILE,
      resourceId: fileId,
      newValue: {
        filename: file.filename,
        manuscriptVersionId: file.manuscriptVersionId,
      },
    });

    // S3 cleanup — best-effort
    try {
      const targetBucket =
        file.scanStatus === 'CLEAN'
          ? storage.defaultBucket
          : storage.quarantineBucket;
      await storage.deleteFromBucket(targetBucket, file.storageKey);
    } catch {
      svc
        .audit({
          action: AuditActions.FILE_DELETED,
          resource: AuditResources.FILE,
          resourceId: fileId,
          newValue: { s3DeleteFailed: true, storageKey: file.storageKey },
        })
        .catch(() => {});
    }

    return { success: true as const };
  },
};
