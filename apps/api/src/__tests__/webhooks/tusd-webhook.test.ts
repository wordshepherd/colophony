import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from '@colophony/db';
import { files, auditEvents } from '@colophony/db';
import {
  globalSetup,
  globalTeardown,
  getAdminPool,
} from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createManuscript,
  createManuscriptVersion,
} from '../rls/helpers/factories';
import { buildWebhookApp } from './helpers/webhook-app';
import {
  createPreCreatePayload,
  createPostFinishPayload,
} from './helpers/tusd-fixtures';

// Mock external dependencies (BullMQ, S3, API key service, embed token service)
// Paths are relative to test file → source module location
vi.mock('../../queues/file-scan.queue.js', () => ({
  enqueueFileScan: vi.fn().mockResolvedValue(undefined),
}));

// Hoisted so the mock fn is a plain vi.fn() rather than an unbound method
// reference — the same pattern as mockMoveBetweenBuckets below.
const { mockVerifyKey } = vi.hoisted(() => ({
  mockVerifyKey: vi.fn(),
}));

vi.mock('../../services/api-key.service.js', () => ({
  apiKeyService: {
    verifyKey: mockVerifyKey,
    touchLastUsed: vi.fn(),
  },
}));

vi.mock('../../services/embed-token.service.js', () => ({
  embedTokenService: {
    verifyToken: vi.fn().mockResolvedValue(null),
  },
}));

// Mock the adapter registry for S3 storage operations (move between buckets)
const { mockMoveBetweenBuckets } = vi.hoisted(() => ({
  mockMoveBetweenBuckets: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../adapters/registry-accessor.js', () => ({
  getGlobalRegistry: () => ({
    resolve: () => ({
      moveBetweenBuckets: mockMoveBetweenBuckets,
      quarantineBucket: 'quarantine',
      defaultBucket: 'submissions',
    }),
    tryResolve: () => null,
  }),
}));

import { enqueueFileScan } from '../../queues/file-scan.queue.js';
const mockEnqueueFileScan = vi.mocked(enqueueFileScan);

// Default: no key resolves. Individual tests queue a result with
// mockResolvedValueOnce. clearAllMocks() keeps implementations, so this
// survives beforeEach.
mockVerifyKey.mockResolvedValue(null);

/** Shape returned by apiKeyService.verifyKey for a healthy key. */
function validKeyResult(userId: string, scopes: string[]) {
  return {
    apiKey: {
      id: 'a0000000-0000-4000-8000-000000000001',
      organizationId: 'b0000000-0000-4000-8000-000000000001',
      createdBy: userId,
      name: 'tusd-test-key',
      scopes,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    },
    creator: {
      id: userId,
      email: 'key-creator@example.com',
      emailVerified: true,
      deletedAt: null,
    },
  };
}

function adminDb() {
  return drizzle(getAdminPool());
}

describe('tusd webhook integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await globalSetup();
    app = await buildWebhookApp();
  });

  afterAll(async () => {
    // `app` is undefined when beforeAll failed. Calling .close() on it throws
    // a TypeError that replaces the real setup error in the report, so guard
    // it and make sure teardown runs either way.
    try {
      await app?.close();
    } finally {
      await globalTeardown();
    }
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
  });

  async function postTusd(payload: unknown) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/tusd',
      payload: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });
  }

  /** Helper: create user + manuscript + manuscript version */
  async function createManuscriptScenario() {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const manuscript = await createManuscript(user.id);
    const version = await createManuscriptVersion(manuscript.id);
    return { org, user, manuscript, version };
  }

  // ──────────────────── Pre-create tests ────────────────────

  describe('pre-create', () => {
    it('valid manuscript version owner → 200 {} (allowed)', async () => {
      const { org, user, version } = await createManuscriptScenario();
      const payload = createPreCreatePayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    it('wrong owner → RejectUpload (version not found via RLS)', async () => {
      const { org, version } = await createManuscriptScenario();
      // Create a different user in the same org
      const otherUser = await createUser();
      await createOrgMember(org.id, otherUser.id);

      const payload = createPreCreatePayload({
        manuscriptVersionId: version.id,
        userId: otherUser.id,
        orgId: org.id,
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      // User-scoped RLS hides versions not owned by the user → 404
      expect(body.HTTPResponse.StatusCode).toBe(404);
    });

    it('file too large → RejectUpload 413', async () => {
      const { org, user, version } = await createManuscriptScenario();
      const payload = createPreCreatePayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
        size: 500 * 1024 * 1024, // 500MB — exceeds limit
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(413);
    });

    it('invalid MIME type → RejectUpload 415', async () => {
      const { org, user, version } = await createManuscriptScenario();
      const payload = createPreCreatePayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
        mimeType: 'application/x-executable',
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(415);
    });

    it('missing X-Test-User-Id → RejectUpload 401', async () => {
      const org = await createOrganization();
      const payload = createPreCreatePayload({
        orgId: org.id,
      });
      // Remove the X-Test-User-Id header — only keep X-Organization-Id
      payload.Event.HTTPRequest.Header = {
        'X-Organization-Id':
          payload.Event.HTTPRequest.Header['X-Organization-Id'],
      } as typeof payload.Event.HTTPRequest.Header;

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(401);
    });

    // The uploads Playwright suite used to be the only thing exercising this
    // branch end to end; it now authenticates via X-Test-User-Id, so the
    // API-key path needs coverage here. Note the branch sits ABOVE the
    // NODE_ENV==='test' one in tusd.webhook.ts, so it stays reachable even
    // though this app runs with NODE_ENV=test.
    it('forwarded X-Api-Key with files:write → resolves the creator and allows', async () => {
      const { org, user, version } = await createManuscriptScenario();
      mockVerifyKey.mockResolvedValueOnce(
        validKeyResult(user.id, ['files:write', 'files:read']),
      );

      const payload = createPreCreatePayload({
        manuscriptVersionId: version.id,
        orgId: org.id,
      });
      payload.Event.HTTPRequest.Header = {
        'X-Api-Key': ['col_live_whatever'],
        'X-Organization-Id':
          payload.Event.HTTPRequest.Header['X-Organization-Id'],
      } as unknown as typeof payload.Event.HTTPRequest.Header;

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      // Allowed: the creator resolved to the manuscript-version owner.
      expect(res.json()).toEqual({});
      expect(mockVerifyKey).toHaveBeenCalledWith('col_live_whatever');
    });

    it('forwarded X-Api-Key without files:write → RejectUpload 403', async () => {
      const { org, version } = await createManuscriptScenario();
      mockVerifyKey.mockResolvedValueOnce(
        validKeyResult('c0000000-0000-4000-8000-000000000001', ['files:read']),
      );

      const payload = createPreCreatePayload({
        manuscriptVersionId: version.id,
        orgId: org.id,
      });
      payload.Event.HTTPRequest.Header = {
        'X-Api-Key': ['col_live_underscoped'],
        'X-Organization-Id':
          payload.Event.HTTPRequest.Header['X-Organization-Id'],
      } as unknown as typeof payload.Event.HTTPRequest.Header;

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(403);
    });

    it('missing manuscript-version-id → RejectUpload 400', async () => {
      const { org, user } = await createManuscriptScenario();
      const payload = createPreCreatePayload({
        userId: user.id,
        orgId: org.id,
      });
      // Remove the manuscript-version-id from metadata
      delete (payload.Event.Upload.MetaData as Record<string, string>)[
        'manuscript-version-id'
      ];

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(400);
    });
  });

  // ──────────────────── Post-finish tests ────────────────────

  describe('post-finish', () => {
    it('file record created + FILE_UPLOADED audit', async () => {
      const { org, user, version } = await createManuscriptScenario();
      const payload = createPostFinishPayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'processed' });

      const db = adminDb();
      const storageKey = payload.Event.Upload.Storage.Key;
      const [file] = await db
        .select()
        .from(files)
        .where(eq(files.storageKey, storageKey));
      expect(file).toBeDefined();
      expect(file.manuscriptVersionId).toBe(version.id);
      expect(file.mimeType).toBe('application/pdf');
      expect(file.scanStatus).toBe('CLEAN'); // VIRUS_SCAN_ENABLED=false

      const [audit] = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, 'FILE_UPLOADED'));
      expect(audit).toBeDefined();
      expect(audit.resourceId).toBe(file.id);
    });

    it('idempotent: same storageKey twice → exactly 1 file row', async () => {
      const { org, user, version } = await createManuscriptScenario();
      const payload = createPostFinishPayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
      });

      const res1 = await postTusd(payload);
      expect(res1.statusCode).toBe(200);

      const res2 = await postTusd(payload);
      expect(res2.statusCode).toBe(200);

      const db = adminDb();
      const storageKey = payload.Event.Upload.Storage.Key;
      const fileRows = await db
        .select()
        .from(files)
        .where(eq(files.storageKey, storageKey));
      expect(fileRows).toHaveLength(1);
    });

    it('enqueueFileScan called when VIRUS_SCAN_ENABLED=true', async () => {
      // Build a separate app with scan enabled
      const scanApp = await buildWebhookApp({ VIRUS_SCAN_ENABLED: true });

      const { org, user, version } = await createManuscriptScenario();
      const payload = createPostFinishPayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
      });

      const res = await scanApp.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        payload: JSON.stringify(payload),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);

      expect(mockEnqueueFileScan).toHaveBeenCalledOnce();
      const callArgs = mockEnqueueFileScan.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        storageKey: payload.Event.Upload.Storage.Key,
      });

      await scanApp.close();
    });

    it('scanStatus=CLEAN immediately when VIRUS_SCAN_ENABLED=false', async () => {
      const { org, user, version } = await createManuscriptScenario();
      const payload = createPostFinishPayload({
        manuscriptVersionId: version.id,
        userId: user.id,
        orgId: org.id,
      });

      await postTusd(payload);

      const db = adminDb();
      const storageKey = payload.Event.Upload.Storage.Key;
      const [file] = await db
        .select()
        .from(files)
        .where(eq(files.storageKey, storageKey));
      expect(file.scanStatus).toBe('CLEAN');
      expect(mockEnqueueFileScan).not.toHaveBeenCalled();
    });
  });
});
