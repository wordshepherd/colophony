import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before imports
// ---------------------------------------------------------------------------

const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
}));

const mockUpdateScanStatus = vi.fn();
vi.mock('../../services/file.service.js', () => ({
  fileService: {
    updateScanStatus: (...args: unknown[]) => mockUpdateScanStatus(...args),
  },
}));

const mockAuditLog = vi.fn();
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

const mockScanStream = vi.fn();
const mockClamInit = vi.fn();
vi.mock('clamscan', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      init: (...args: unknown[]) => {
        mockClamInit(...args);
        return Promise.resolve({ scanStream: mockScanStream });
      },
    };
  }),
}));

// Mock BullMQ Worker — capture the processor function
let capturedProcessor: ((job: unknown) => Promise<void>) | null = null;
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function (
    _name: string,
    processor: (job: unknown) => Promise<void>,
  ) {
    capturedProcessor = processor;
    return {
      on: vi.fn(),
      close: vi.fn(),
    };
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { startFileScanWorker } from '../file-scan.worker.js';
import type { Env } from '../../config/env.js';
import type { AdapterRegistry } from '@colophony/plugin-sdk';

const mockDownloadFromBucket = vi.fn();
const mockMoveBetweenBuckets = vi.fn();
const mockDeleteFromBucket = vi.fn();

const mockStorage = {
  defaultBucket: 'submissions',
  quarantineBucket: 'quarantine',
  downloadFromBucket: (...args: unknown[]) => mockDownloadFromBucket(...args),
  moveBetweenBuckets: (...args: unknown[]) => mockMoveBetweenBuckets(...args),
  deleteFromBucket: (...args: unknown[]) => mockDeleteFromBucket(...args),
};

const mockRegistry = {
  resolve: vi.fn(() => mockStorage),
} as unknown as AdapterRegistry;

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
  VIRUS_SCAN_ENABLED: true,
} as Env;

const TEST_JOB = {
  data: {
    fileId: 'file-1',
    storageKey: 'quarantine/upload-abc',
    organizationId: 'org-1',
  },
  id: 'file-1',
  attemptsMade: 1,
  opts: { attempts: 3 },
};

describe('file-scan worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
    // withRls passes through to the callback with a mock tx
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => fn({}),
    );
  });

  function getProcessor() {
    startFileScanWorker(testEnv, mockRegistry);
    if (!capturedProcessor) throw new Error('Worker processor not captured');
    return capturedProcessor;
  }

  // -------------------------------------------------------------------------
  // CLEAN path
  // -------------------------------------------------------------------------

  it('marks file CLEAN, moves from quarantine to submissions bucket', async () => {
    const processor = getProcessor();

    mockDownloadFromBucket.mockResolvedValueOnce({ pipe: vi.fn() }); // mock Readable
    mockScanStream.mockResolvedValueOnce({
      isInfected: false,
      viruses: [],
    });
    mockMoveBetweenBuckets.mockResolvedValueOnce(undefined);
    mockUpdateScanStatus.mockResolvedValue(null);
    mockAuditLog.mockResolvedValue(undefined);

    await processor(TEST_JOB);

    // Phase 1: set SCANNING
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'SCANNING',
    );

    // Phase 3: CLEAN — move between buckets
    expect(mockMoveBetweenBuckets).toHaveBeenCalledWith(
      'quarantine',
      'quarantine/upload-abc',
      'submissions',
      'quarantine/upload-abc',
    );

    // Update status to CLEAN
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'CLEAN',
    );

    // Audit logged
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'FILE_SCAN_CLEAN',
        resource: 'file',
        resourceId: 'file-1',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // INFECTED path
  // -------------------------------------------------------------------------

  it('marks file INFECTED, deletes from quarantine, does NOT move', async () => {
    const processor = getProcessor();

    mockDownloadFromBucket.mockResolvedValueOnce({ pipe: vi.fn() });
    mockScanStream.mockResolvedValueOnce({
      isInfected: true,
      viruses: ['Eicar-Test-Signature'],
    });
    mockDeleteFromBucket.mockResolvedValueOnce(undefined);
    mockUpdateScanStatus.mockResolvedValue(null);
    mockAuditLog.mockResolvedValue(undefined);

    await processor(TEST_JOB);

    // Should NOT move to submissions bucket
    expect(mockMoveBetweenBuckets).not.toHaveBeenCalled();

    // Delete from quarantine
    expect(mockDeleteFromBucket).toHaveBeenCalledWith(
      'quarantine',
      'quarantine/upload-abc',
    );

    // Update status to INFECTED
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'INFECTED',
    );

    // Audit logged with virus names
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'FILE_SCAN_INFECTED',
        resource: 'file',
        newValue: { viruses: ['Eicar-Test-Signature'] },
      }),
    );
  });

  // -------------------------------------------------------------------------
  // FAILED path (ClamAV error)
  // -------------------------------------------------------------------------

  it('marks file FAILED and re-throws on scan error', async () => {
    const processor = getProcessor();

    mockDownloadFromBucket.mockRejectedValueOnce(
      new Error('S3 connection timeout'),
    );
    mockUpdateScanStatus.mockResolvedValue(null);
    mockAuditLog.mockResolvedValue(undefined);

    await expect(processor(TEST_JOB)).rejects.toThrow('S3 connection timeout');

    // Should set SCANNING first
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'SCANNING',
    );

    // Then set FAILED
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'FAILED',
    );

    // Audit logged with error
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'FILE_SCAN_FAILED',
        resource: 'file',
        newValue: { error: 'S3 connection timeout' },
      }),
    );
  });

  // -------------------------------------------------------------------------
  // FAILED path (post-scan S3 error)
  // -------------------------------------------------------------------------

  it('marks file FAILED when S3 move fails after clean scan', async () => {
    const processor = getProcessor();

    mockDownloadFromBucket.mockResolvedValueOnce({ pipe: vi.fn() });
    mockScanStream.mockResolvedValueOnce({
      isInfected: false,
      viruses: [],
    });
    mockMoveBetweenBuckets.mockRejectedValueOnce(new Error('S3 move failed'));
    mockUpdateScanStatus.mockResolvedValue(null);
    mockAuditLog.mockResolvedValue(undefined);

    await expect(processor(TEST_JOB)).rejects.toThrow('S3 move failed');

    // Should have set SCANNING, then FAILED (not CLEAN)
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'SCANNING',
    );
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'FAILED',
    );
    expect(mockUpdateScanStatus).not.toHaveBeenCalledWith(
      expect.anything(),
      'file-1',
      'CLEAN',
    );

    // Audit includes phase info
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'FILE_SCAN_FAILED',
        newValue: expect.objectContaining({
          phase: 'post-scan-s3',
          scanResult: 'CLEAN',
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // RLS wrapping
  // -------------------------------------------------------------------------

  it('wraps all DB operations in withRls with correct orgId', async () => {
    const processor = getProcessor();

    mockDownloadFromBucket.mockResolvedValueOnce({ pipe: vi.fn() });
    mockScanStream.mockResolvedValueOnce({
      isInfected: false,
      viruses: [],
    });
    mockMoveBetweenBuckets.mockResolvedValueOnce(undefined);
    mockUpdateScanStatus.mockResolvedValue(null);
    mockAuditLog.mockResolvedValue(undefined);

    await processor(TEST_JOB);

    // withRls called with orgId for each DB phase
    const rlsCalls = mockWithRls.mock.calls;
    for (const call of rlsCalls) {
      expect(call[0]).toEqual({ orgId: 'org-1' });
    }
    // At least 2 calls: SCANNING + CLEAN status updates
    expect(rlsCalls.length).toBeGreaterThanOrEqual(2);
  });
});
