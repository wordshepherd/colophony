import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { Readable } from 'node:stream';
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

import type { ContentExtractJobData } from '../../queues/content-extract.queue';
import {
  startContentExtractWorker,
  stopContentExtractWorker,
} from '../../workers/content-extract.worker';
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
  createUser,
  createManuscript,
  createManuscriptVersion,
  createFile,
} from '../rls/helpers/factories';
import { manuscriptVersions, eq } from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../rls/helpers/db-setup';

function adminDb(): ReturnType<typeof drizzle> {
  return drizzle(getAdminPool());
}

function textStream(text: string): Readable {
  return Readable.from(Buffer.from(text));
}

describe('content-extract queue integration', () => {
  const env = createTestEnv();
  const mockStorage = createMockStorage();
  const mockRegistry = createMockRegistry({ storage: mockStorage });
  let queue: Queue<ContentExtractJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startContentExtractWorker(env, mockRegistry as any);
    queue = new Queue<ContentExtractJobData>('content-extract', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopContentExtractWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
  });

  it('extracts .txt content → COMPLETE with ProseMirror JSON', async () => {
    const user = await createUser();
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const file = await createFile(version.id, {
      mimeType: 'text/plain',
      filename: 'story.txt',
    });

    mockStorage.downloadFromBucket.mockResolvedValue(
      textStream('First paragraph\n\nSecond paragraph'),
    );

    const jobData: ContentExtractJobData = {
      fileId: file.id,
      storageKey: file.storageKey,
      manuscriptVersionId: version.id,
      userId: user.id,
      mimeType: 'text/plain',
      filename: 'story.txt',
    };

    await queue.add('extract', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, version.id));

    expect(updated.contentExtractionStatus).toBe('COMPLETE');
    expect(updated.contentFormat).toBe('prosemirror_v1');
    expect(updated.content).toBeDefined();

    const doc = updated.content as any;
    expect(doc.type).toBe('doc');
    expect(doc.content.length).toBeGreaterThan(0);
    expect(doc.attrs?.smart_typography_applied).toBe(true);
    expect(doc.attrs?.submission_metadata?.original_filename).toBe('story.txt');
  });

  it('marks UNSUPPORTED for unknown MIME type', async () => {
    const user = await createUser();
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const file = await createFile(version.id, {
      mimeType: 'image/png',
      filename: 'photo.png',
    });

    mockStorage.downloadFromBucket.mockResolvedValue(
      textStream('not relevant'),
    );

    const jobData: ContentExtractJobData = {
      fileId: file.id,
      storageKey: file.storageKey,
      manuscriptVersionId: version.id,
      userId: user.id,
      mimeType: 'image/png',
      filename: 'photo.png',
    };

    await queue.add('extract', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, version.id));

    expect(updated.contentExtractionStatus).toBe('UNSUPPORTED');
    expect(updated.content).toBeNull();
  });

  it('skips extraction if version already COMPLETE (idempotency)', async () => {
    const user = await createUser();
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const file = await createFile(version.id, {
      mimeType: 'text/plain',
      filename: 'story.txt',
    });

    // Pre-set status to COMPLETE
    const db = adminDb();
    await db
      .update(manuscriptVersions)
      .set({ contentExtractionStatus: 'COMPLETE' })
      .where(eq(manuscriptVersions.id, version.id));

    const jobData: ContentExtractJobData = {
      fileId: file.id,
      storageKey: file.storageKey,
      manuscriptVersionId: version.id,
      userId: user.id,
      mimeType: 'text/plain',
      filename: 'story.txt',
    };

    await queue.add('extract', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    // S3 should NOT have been called
    expect(mockStorage.downloadFromBucket).not.toHaveBeenCalled();
  });

  it('applies smart typography to extracted content', async () => {
    const user = await createUser();
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const file = await createFile(version.id, {
      mimeType: 'text/plain',
      filename: 'quotes.txt',
    });

    mockStorage.downloadFromBucket.mockResolvedValue(
      textStream('She said "hello" -- it\'s fine...'),
    );

    const jobData: ContentExtractJobData = {
      fileId: file.id,
      storageKey: file.storageKey,
      manuscriptVersionId: version.id,
      userId: user.id,
      mimeType: 'text/plain',
      filename: 'quotes.txt',
    };

    await queue.add('extract', jobData, { jobId: file.id });
    await waitForJobCompletion(queue, file.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, version.id));

    const doc = updated.content as any;
    expect(doc.attrs?.smart_typography_applied).toBe(true);

    // The text should have curly quotes, em dash, ellipsis
    const text = doc.content[0]?.text;
    expect(text).toContain('\u201c'); // left double quote
    expect(text).toContain('\u2014'); // em dash
    expect(text).toContain('\u2026'); // ellipsis

    // Original should be preserved in smart_text mark
    const marks = doc.content[0]?.marks;
    expect(marks).toBeDefined();
    expect(marks[0]?.type).toBe('smart_text');
    expect(marks[0]?.attrs?.original).toContain('"hello"');
  });

  it('marks FAILED on S3 download error and retries', async () => {
    const user = await createUser();
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    const file = await createFile(version.id, {
      mimeType: 'text/plain',
      filename: 'story.txt',
    });

    mockStorage.downloadFromBucket.mockRejectedValue(
      new Error('S3 connection timeout'),
    );

    const jobData: ContentExtractJobData = {
      fileId: file.id,
      storageKey: file.storageKey,
      manuscriptVersionId: version.id,
      userId: user.id,
      mimeType: 'text/plain',
      filename: 'story.txt',
    };

    // Use attempts: 1 to avoid waiting for retries
    await queue.add('extract', jobData, { jobId: file.id, attempts: 1 });
    await waitForJobFailure(queue, file.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, version.id));

    expect(updated.contentExtractionStatus).toBe('FAILED');
  });
});
