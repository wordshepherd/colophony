import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DrizzleDb } from '@colophony/db';

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  files: {
    id: 'id',
    manuscriptVersionId: 'manuscriptVersionId',
    storageKey: 'storageKey',
    uploadedAt: 'uploadedAt',
    size: 'size',
    scanStatus: 'scanStatus',
  },
  manuscripts: { id: 'id', ownerId: 'ownerId' },
  manuscriptVersions: { id: 'id', manuscriptId: 'manuscriptId' },
  eq: vi.fn((a, b) => ({ _eq: [a, b] })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      _tag: 'sql',
      strings,
      values,
    }),
    { raw: (s: string) => ({ _tag: 'sql_raw', value: s }) },
  ),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  asc: vi.fn((col) => ({ _asc: col })),
  count: vi.fn(() => ({ _count: true })),
}));

// Mock @colophony/types
vi.mock('@colophony/types', () => ({
  MAX_FILES_PER_MANUSCRIPT_VERSION: 10,
  MAX_TOTAL_UPLOAD_SIZE: 100_000_000,
  MAX_FILE_SIZE: 25_000_000,
  ALLOWED_MIME_TYPES: ['application/pdf'],
  AuditActions: { FILE_DELETED: 'FILE_DELETED' },
  AuditResources: { FILE: 'file' },
}));

import { fileService, FileNotCleanError } from './file.service.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';

// Helper: create a mock tx that returns a file from getById
function makeTx(file: Record<string, unknown> | null): DrizzleDb {
  const mockLimit = vi.fn().mockResolvedValue(file ? [file] : []);
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
    returning: vi.fn().mockResolvedValue(file ? [file] : []),
  });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockDeleteFn = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(file ? [file] : []),
    }),
  });
  return { select: mockSelect, delete: mockDeleteFn } as unknown as DrizzleDb;
}

const mockGetSignedUrlFromBucket = vi
  .fn()
  .mockResolvedValue('https://s3.example.com/signed');
const mockDeleteFromBucket = vi.fn().mockResolvedValue(undefined);

const mockStorage = {
  defaultBucket: 'main-bucket',
  quarantineBucket: 'quarantine-bucket',
  getSignedUrlFromBucket: mockGetSignedUrlFromBucket,
  deleteFromBucket: mockDeleteFromBucket,
} as unknown as S3StorageAdapter;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fileService.getDownloadUrl', () => {
  it('returns presigned URL for a CLEAN file', async () => {
    const file = {
      id: 'f1',
      storageKey: 'uploads/f1.pdf',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      scanStatus: 'CLEAN',
    };
    const tx = makeTx(file);

    const result = await fileService.getDownloadUrl(tx, 'f1', mockStorage);

    expect(result).toEqual({
      url: 'https://s3.example.com/signed',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
    });
    expect(mockGetSignedUrlFromBucket).toHaveBeenCalledWith(
      'main-bucket',
      'uploads/f1.pdf',
    );
  });

  it('returns null when file not found', async () => {
    const tx = makeTx(null);

    const result = await fileService.getDownloadUrl(
      tx,
      'nonexistent',
      mockStorage,
    );

    expect(result).toBeNull();
    expect(mockGetSignedUrlFromBucket).not.toHaveBeenCalled();
  });

  it('throws FileNotCleanError for non-CLEAN files', async () => {
    const file = {
      id: 'f2',
      storageKey: 'uploads/f2.pdf',
      filename: 'suspect.pdf',
      mimeType: 'application/pdf',
      scanStatus: 'PENDING',
    };
    const tx = makeTx(file);

    await expect(
      fileService.getDownloadUrl(tx, 'f2', mockStorage),
    ).rejects.toThrow(FileNotCleanError);
  });
});

describe('fileService.deleteWithS3', () => {
  it('deletes DB record and S3 object from main bucket for CLEAN file', async () => {
    const file = {
      id: 'f1',
      storageKey: 'uploads/f1.pdf',
      scanStatus: 'CLEAN',
    };
    const tx = makeTx(file);

    const result = await fileService.deleteWithS3(tx, 'f1', mockStorage);

    expect(result).toEqual(file);
    expect(mockDeleteFromBucket).toHaveBeenCalledWith(
      'main-bucket',
      'uploads/f1.pdf',
    );
  });

  it('uses quarantine bucket for non-CLEAN files', async () => {
    const file = {
      id: 'f2',
      storageKey: 'uploads/f2.pdf',
      scanStatus: 'INFECTED',
    };
    const tx = makeTx(file);

    await fileService.deleteWithS3(tx, 'f2', mockStorage);

    expect(mockDeleteFromBucket).toHaveBeenCalledWith(
      'quarantine-bucket',
      'uploads/f2.pdf',
    );
  });

  it('returns null when file not found', async () => {
    const tx = makeTx(null);

    const result = await fileService.deleteWithS3(
      tx,
      'nonexistent',
      mockStorage,
    );

    expect(result).toBeNull();
    expect(mockDeleteFromBucket).not.toHaveBeenCalled();
  });
});
