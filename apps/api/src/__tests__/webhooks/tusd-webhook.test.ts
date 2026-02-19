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
import { submissionFiles, auditEvents } from '@colophony/db';
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
  createSubmissionPeriod,
  createSubmission,
} from '../rls/helpers/factories';
import { buildWebhookApp } from './helpers/webhook-app';
import {
  createPreCreatePayload,
  createPostFinishPayload,
} from './helpers/tusd-fixtures';

// Mock external dependencies (BullMQ, S3, API key service)
// Paths are relative to test file → source module location
vi.mock('../../queues/file-scan.queue.js', () => ({
  enqueueFileScan: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/s3.js', () => ({
  createS3Client: vi.fn().mockReturnValue({}),
  copyObject: vi.fn().mockResolvedValue(undefined),
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/api-key.service.js', () => ({
  apiKeyService: {
    verifyKey: vi.fn().mockResolvedValue(null),
    touchLastUsed: vi.fn(),
  },
}));

import { enqueueFileScan } from '../../queues/file-scan.queue.js';
const mockEnqueueFileScan = vi.mocked(enqueueFileScan);

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
    await app.close();
    await globalTeardown();
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

  /** Helper: create org + user + member + period + submission (DRAFT) */
  async function createDraftSubmissionScenario() {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const period = await createSubmissionPeriod(org.id);
    const submission = await createSubmission(org.id, user.id, {
      submissionPeriodId: period.id,
      status: 'DRAFT',
    });
    return { org, user, submission };
  }

  // ──────────────────── Pre-create tests ────────────────────

  describe('pre-create', () => {
    it('valid DRAFT submission owner → 200 {} (allowed)', async () => {
      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPreCreatePayload({
        submissionId: submission.id,
        userId: user.id,
        orgId: org.id,
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });

    it('non-DRAFT submission → RejectUpload 409', async () => {
      const { org, user, submission } = await createDraftSubmissionScenario();
      // Update submission to SUBMITTED via admin pool
      const admin = getAdminPool();
      await admin.query(
        `UPDATE submissions SET status = 'SUBMITTED' WHERE id = $1`,
        [submission.id],
      );

      const payload = createPreCreatePayload({
        submissionId: submission.id,
        userId: user.id,
        orgId: org.id,
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(409);
    });

    it('wrong owner → RejectUpload 422', async () => {
      const { org, submission } = await createDraftSubmissionScenario();
      // Create a different user in the same org
      const otherUser = await createUser();
      await createOrgMember(org.id, otherUser.id);

      const payload = createPreCreatePayload({
        submissionId: submission.id,
        userId: otherUser.id,
        orgId: org.id,
      });

      const res = await postTusd(payload);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.StatusCode).toBe(422);
    });

    it('file too large → RejectUpload 413', async () => {
      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPreCreatePayload({
        submissionId: submission.id,
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
      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPreCreatePayload({
        submissionId: submission.id,
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
  });

  // ──────────────────── Post-finish tests ────────────────────

  describe('post-finish', () => {
    it('file record created + FILE_UPLOADED audit', async () => {
      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPostFinishPayload({
        submissionId: submission.id,
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
        .from(submissionFiles)
        .where(eq(submissionFiles.storageKey, storageKey));
      expect(file).toBeDefined();
      expect(file.submissionId).toBe(submission.id);
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
      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPostFinishPayload({
        submissionId: submission.id,
        userId: user.id,
        orgId: org.id,
      });

      const res1 = await postTusd(payload);
      expect(res1.statusCode).toBe(200);

      const res2 = await postTusd(payload);
      expect(res2.statusCode).toBe(200);

      const db = adminDb();
      const storageKey = payload.Event.Upload.Storage.Key;
      const files = await db
        .select()
        .from(submissionFiles)
        .where(eq(submissionFiles.storageKey, storageKey));
      expect(files).toHaveLength(1);
    });

    it('enqueueFileScan called when VIRUS_SCAN_ENABLED=true', async () => {
      // Build a separate app with scan enabled
      const scanApp = await buildWebhookApp({ VIRUS_SCAN_ENABLED: true });

      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPostFinishPayload({
        submissionId: submission.id,
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
        organizationId: org.id,
      });

      await scanApp.close();
    });

    it('scanStatus=CLEAN immediately when VIRUS_SCAN_ENABLED=false', async () => {
      const { org, user, submission } = await createDraftSubmissionScenario();
      const payload = createPostFinishPayload({
        submissionId: submission.id,
        userId: user.id,
        orgId: org.id,
      });

      await postTusd(payload);

      const db = adminDb();
      const storageKey = payload.Event.Upload.Storage.Key;
      const [file] = await db
        .select()
        .from(submissionFiles)
        .where(eq(submissionFiles.storageKey, storageKey));
      expect(file.scanStatus).toBe('CLEAN');
      expect(mockEnqueueFileScan).not.toHaveBeenCalled();
    });
  });
});
