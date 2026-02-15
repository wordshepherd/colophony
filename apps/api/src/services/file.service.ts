import { submissionFiles, eq, sql, type DrizzleDb } from '@colophony/db';
import { asc, count } from 'drizzle-orm';
import type { ScanStatus } from '@colophony/types';
import {
  MAX_FILES_PER_SUBMISSION,
  MAX_TOTAL_UPLOAD_SIZE,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from '@colophony/types';

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
      `Maximum of ${MAX_FILES_PER_SUBMISSION} files per submission exceeded`,
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const fileService = {
  async listBySubmission(tx: DrizzleDb, submissionId: string) {
    return tx
      .select()
      .from(submissionFiles)
      .where(eq(submissionFiles.submissionId, submissionId))
      .orderBy(asc(submissionFiles.uploadedAt));
  },

  async getById(tx: DrizzleDb, fileId: string) {
    const [file] = await tx
      .select()
      .from(submissionFiles)
      .where(eq(submissionFiles.id, fileId))
      .limit(1);
    return file ?? null;
  },

  async getByStorageKey(tx: DrizzleDb, storageKey: string) {
    const [file] = await tx
      .select()
      .from(submissionFiles)
      .where(eq(submissionFiles.storageKey, storageKey))
      .limit(1);
    return file ?? null;
  },

  async create(
    tx: DrizzleDb,
    input: {
      submissionId: string;
      filename: string;
      mimeType: string;
      size: number;
      storageKey: string;
    },
  ) {
    const [file] = await tx
      .insert(submissionFiles)
      .values({
        submissionId: input.submissionId,
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
      .update(submissionFiles)
      .set({
        scanStatus,
        scannedAt: scanStatus === 'PENDING' ? null : sql`now()`,
      })
      .where(eq(submissionFiles.id, fileId))
      .returning();
    return updated ?? null;
  },

  async delete(tx: DrizzleDb, fileId: string) {
    const [deleted] = await tx
      .delete(submissionFiles)
      .where(eq(submissionFiles.id, fileId))
      .returning();
    return deleted ?? null;
  },

  async countBySubmission(tx: DrizzleDb, submissionId: string) {
    const [result] = await tx
      .select({ count: count() })
      .from(submissionFiles)
      .where(eq(submissionFiles.submissionId, submissionId));
    return result?.count ?? 0;
  },

  async totalSizeBySubmission(tx: DrizzleDb, submissionId: string) {
    const [result] = await tx
      .select({ total: sql<number>`coalesce(sum(${submissionFiles.size}), 0)` })
      .from(submissionFiles)
      .where(eq(submissionFiles.submissionId, submissionId));
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
    submissionId: string,
    newFileSize: number,
  ): Promise<void> {
    const fileCount = await fileService.countBySubmission(tx, submissionId);
    if (fileCount >= MAX_FILES_PER_SUBMISSION) {
      throw new FileLimitExceededError();
    }

    const totalSize = await fileService.totalSizeBySubmission(tx, submissionId);
    if (totalSize + newFileSize > MAX_TOTAL_UPLOAD_SIZE) {
      throw new TotalSizeLimitExceededError();
    }
  },
};
