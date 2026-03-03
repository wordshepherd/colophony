import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { PassThrough } from 'node:stream';
import { Queue } from 'bullmq';

// Mock metrics, sentry, logger — must be before worker imports
vi.mock('../../config/metrics.js', () => ({
  bullmqJobDuration: { observe: vi.fn() },
  bullmqJobTotal: { inc: vi.fn() },
}));
vi.mock('../../config/sentry.js', () => ({
  captureException: vi.fn(),
}));
vi.mock('../../config/logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock ClamAV — module-level since worker does `new NodeClam().init()`
const mockScanStream = vi.fn();
vi.mock('clamscan', () => ({
  default: function MockNodeClam() {
    return {
      init: vi.fn().mockResolvedValue({
        scanStream: mockScanStream,
      }),
    };
  },
}));

import type { FileScanJobData } from '../../queues/file-scan.queue';
import {
  startFileScanWorker,
  stopFileScanWorker,
} from '../../workers/file-scan.worker';
import { globalSetup } from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { flushRedis, closeRedis, getRedisConfig } from './helpers/redis-setup';
import {
  waitForJobCompletion,
  waitForJobFailure,
  closeAllQueueEvents,
} from './helpers/job-helpers';
import {
  createMockStorage,
  createMockRegistry,
  createTestEnv,
} from './helpers/mock-adapters';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createManuscript,
  createManuscriptVersion,
  createFile,
} from '../rls/helpers/factories';
import { files, eq } from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../rls/helpers/db-setup';

function adminDb(): any {
  return drizzle(getAdminPool());
}

describe('file-scan queue integration', () => {
  const env = createTestEnv();
  const mockStorage = createMockStorage();
  const mockRegistry = createMockRegistry({ storage: mockStorage });
  let queue: Queue<FileScanJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startFileScanWorker(env, mockRegistry as any);
    queue = new Queue<FileScanJobData>('file-scan', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopFileScanWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
  });

  it('enqueue → file status transitions PENDING → SCANNING → CLEAN', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const storageKey = `uploads/${Date.now()}/test.pdf`;
    const file = await createFile(version.id, {
      scanStatus: 'PENDING' as any,
      storageKey,
    });

    // Mock ClamAV: file is clean
    mockScanStream.mockResolvedValue({ isInfected: false, viruses: [] });

    // Mock S3: return a readable stream
    const stream = new PassThrough();
    stream.end(Buffer.from('test file content'));
    mockStorage.downloadFromBucket.mockResolvedValue(stream);

    const jobData: FileScanJobData = {
      fileId: file.id,
      storageKey,
      userId: user.id,
      organizationId: org.id,
    };

    await queue.add('scan', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    // Verify file status in DB
    const db = adminDb();
    const [updatedFile] = await db
      .select()
      .from(files)
      .where(eq(files.id, file.id));

    expect(updatedFile.scanStatus).toBe('CLEAN');
    expect(updatedFile.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mockStorage.moveBetweenBuckets).toHaveBeenCalledWith(
      'quarantine',
      storageKey,
      'submissions',
      storageKey,
    );
  });

  it('marks file INFECTED and deletes from quarantine', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const storageKey = `uploads/${Date.now()}/infected.pdf`;
    const file = await createFile(version.id, {
      scanStatus: 'PENDING' as any,
      storageKey,
    });

    // Mock ClamAV: file is infected
    mockScanStream.mockResolvedValue({
      isInfected: true,
      viruses: ['TestVirus'],
    });

    const stream = new PassThrough();
    stream.end(Buffer.from('infected content'));
    mockStorage.downloadFromBucket.mockResolvedValue(stream);

    const jobData: FileScanJobData = {
      fileId: file.id,
      storageKey,
      userId: user.id,
      organizationId: org.id,
    };

    await queue.add('scan', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    const db = adminDb();
    const [updatedFile] = await db
      .select()
      .from(files)
      .where(eq(files.id, file.id));

    expect(updatedFile.scanStatus).toBe('INFECTED');
    expect(mockStorage.deleteFromBucket).toHaveBeenCalledWith(
      'quarantine',
      storageKey,
    );
  });

  it('marks file FAILED on scan error', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const storageKey = `uploads/${Date.now()}/error.pdf`;
    const file = await createFile(version.id, {
      scanStatus: 'PENDING' as any,
      storageKey,
    });

    // Mock S3: download fails
    mockStorage.downloadFromBucket.mockRejectedValue(
      new Error('S3 download error'),
    );

    const jobData: FileScanJobData = {
      fileId: file.id,
      storageKey,
      userId: user.id,
      organizationId: org.id,
    };

    await queue.add('scan', jobData, {
      jobId: file.id,
      attempts: 1,
    });
    await waitForJobFailure(queue, file.id);

    const db = adminDb();
    const [updatedFile] = await db
      .select()
      .from(files)
      .where(eq(files.id, file.id));

    expect(updatedFile.scanStatus).toBe('FAILED');
  });

  it('job idempotency — duplicate enqueue is no-op', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const storageKey = `uploads/${Date.now()}/dedup.pdf`;
    const file = await createFile(version.id, {
      scanStatus: 'PENDING' as any,
      storageKey,
    });

    mockScanStream.mockResolvedValue({ isInfected: false, viruses: [] });
    const stream = new PassThrough();
    stream.end(Buffer.from('dedup content'));
    mockStorage.downloadFromBucket.mockResolvedValue(stream);

    const jobData: FileScanJobData = {
      fileId: file.id,
      storageKey,
      userId: user.id,
      organizationId: org.id,
    };

    // Enqueue the same job twice (same jobId)
    await queue.add('scan', jobData, { jobId: file.id });
    await queue.add('scan', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    const db = adminDb();
    const [updatedFile] = await db
      .select()
      .from(files)
      .where(eq(files.id, file.id));

    expect(updatedFile.scanStatus).toBe('CLEAN');
    // downloadFromBucket should only be called once (not twice)
    expect(mockStorage.downloadFromBucket).toHaveBeenCalledTimes(1);
  });
});
