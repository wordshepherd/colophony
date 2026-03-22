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
import { documensoWebhookEvents } from '@colophony/db';
import {
  globalSetup,
  globalTeardown,
  getAdminPool,
} from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { buildWebhookApp } from './helpers/webhook-app';
import {
  createDocumentSignedEvent,
  createDocumentCompletedEvent,
  createUnknownEvent,
  signPayload,
} from './helpers/documenso-fixtures';

const WEBHOOK_SECRET = 'test-documenso-webhook-secret-32chars!';

// Mock contractService — called inside the webhook handler via processDocumensoEvent
const { mockGetByDocumensoDocumentId, mockUpdateStatus } = vi.hoisted(() => ({
  mockGetByDocumensoDocumentId: vi.fn(),
  mockUpdateStatus: vi.fn(),
}));

vi.mock('../../services/contract.service.js', () => ({
  contractService: {
    getByDocumensoDocumentId: mockGetByDocumensoDocumentId,
    updateStatus: mockUpdateStatus,
  },
}));

// Mock auditService — called inside withRls for contract status changes
const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: mockAuditLog,
  },
}));

// Mock inngest to prevent real event sending
const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../inngest/client.js', () => ({
  inngest: {
    send: mockInngestSend,
  },
}));

function adminDb() {
  return drizzle(getAdminPool());
}

describe('Documenso webhook integration', () => {
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

  async function postDocumenso(body: string, signature?: string) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/documenso',
      payload: body,
      headers: {
        'content-type': 'application/json',
        ...(signature !== undefined
          ? { 'x-documenso-signature': signature }
          : {}),
      },
    });
  }

  function postSigned(payload: object) {
    const body = JSON.stringify(payload);
    const sig = signPayload(body, WEBHOOK_SECRET);
    return postDocumenso(body, sig);
  }

  // ---- Happy path: DOCUMENT_SIGNED ----

  it('DOCUMENT_SIGNED → contract SIGNED + audit + inngest event', async () => {
    const fakeContract = {
      id: 'contract-1',
      organizationId: 'org-1',
      status: 'SENT',
    };
    mockGetByDocumensoDocumentId.mockResolvedValue(fakeContract);
    mockUpdateStatus.mockResolvedValue({ ...fakeContract, status: 'SIGNED' });

    const event = createDocumentSignedEvent({ documentId: 'doc-123' });
    const res = await postSigned(event);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    // contractService called correctly
    expect(mockGetByDocumensoDocumentId).toHaveBeenCalledWith(
      expect.anything(), // tx
      'doc-123',
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      expect.anything(), // rlsTx
      'contract-1',
      'SIGNED',
      expect.objectContaining({ signedAt: expect.any(Date) }),
      'org-1', // defense-in-depth org filter
    );

    // Audit logged
    expect(mockAuditLog).toHaveBeenCalledWith(expect.anything(), {
      resource: 'contract',
      action: 'CONTRACT_SIGNED',
      organizationId: 'org-1',
      resourceId: 'contract-1',
      oldValue: { status: 'SENT' },
      newValue: { status: 'SIGNED', documensoDocumentId: 'doc-123' },
    });

    // Inngest event sent after commit
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'slate/contract.signed',
      data: expect.objectContaining({
        orgId: 'org-1',
        contractId: 'contract-1',
        documensoDocumentId: 'doc-123',
      }),
    });

    // Webhook event marked processed in DB
    const db = adminDb();
    const events = await db.select().from(documensoWebhookEvents);
    expect(events).toHaveLength(1);
    expect(events[0].processed).toBe(true);
    expect(events[0].type).toBe('DOCUMENT_SIGNED');
  });

  // ---- Happy path: DOCUMENT_COMPLETED ----

  it('DOCUMENT_COMPLETED → contract COMPLETED + audit + inngest event', async () => {
    const fakeContract = {
      id: 'contract-2',
      organizationId: 'org-2',
      status: 'SIGNED',
    };
    mockGetByDocumensoDocumentId.mockResolvedValue(fakeContract);
    mockUpdateStatus.mockResolvedValue({
      ...fakeContract,
      status: 'COMPLETED',
    });

    const event = createDocumentCompletedEvent({ documentId: 'doc-456' });
    const res = await postSigned(event);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      expect.anything(),
      'contract-2',
      'COMPLETED',
      expect.objectContaining({ completedAt: expect.any(Date) }),
      'org-2', // defense-in-depth org filter
    );

    // Audit logged
    expect(mockAuditLog).toHaveBeenCalledWith(expect.anything(), {
      resource: 'contract',
      action: 'CONTRACT_COMPLETED',
      organizationId: 'org-2',
      resourceId: 'contract-2',
      oldValue: { status: 'SIGNED' },
      newValue: { status: 'COMPLETED', documensoDocumentId: 'doc-456' },
    });

    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'slate/contract.completed',
      data: expect.objectContaining({
        contractId: 'contract-2',
        documensoDocumentId: 'doc-456',
      }),
    });
  });

  // ---- No matching contract ----

  it('DOCUMENT_SIGNED with no matching contract → processed, no update', async () => {
    mockGetByDocumensoDocumentId.mockResolvedValue(null);

    const event = createDocumentSignedEvent({ documentId: 'unknown-doc' });
    const res = await postSigned(event);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();

    // Event still marked processed
    const db = adminDb();
    const events = await db.select().from(documensoWebhookEvents);
    expect(events).toHaveLength(1);
    expect(events[0].processed).toBe(true);
  });

  // ---- Idempotency ----

  it('idempotency: same event twice → second returns already_processed', async () => {
    const fakeContract = {
      id: 'contract-3',
      organizationId: 'org-3',
      status: 'SENT',
    };
    mockGetByDocumensoDocumentId.mockResolvedValue(fakeContract);
    mockUpdateStatus.mockResolvedValue({ ...fakeContract, status: 'SIGNED' });

    const event = createDocumentSignedEvent({ documentId: 'doc-dup' });

    const res1 = await postSigned(event);
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ status: 'processed' });

    const res2 = await postSigned(event);
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ status: 'already_processed' });

    // contractService called only once
    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);

    // Only 1 webhook event row
    const db = adminDb();
    const events = await db.select().from(documensoWebhookEvents);
    expect(events).toHaveLength(1);
  });

  // ---- Crash recovery ----

  it('crash recovery: unprocessed event row → reprocesses', async () => {
    const fakeContract = {
      id: 'contract-4',
      organizationId: 'org-4',
      status: 'SENT',
    };
    mockGetByDocumensoDocumentId.mockResolvedValue(fakeContract);
    mockUpdateStatus.mockResolvedValue({ ...fakeContract, status: 'SIGNED' });

    const event = createDocumentSignedEvent({ documentId: 'doc-crash' });
    const documensoId = `${event.event}:${event.data.id}`;

    // Pre-insert with processed=false (simulates crash after INSERT before COMMIT)
    const admin = getAdminPool();
    await admin.query(
      `INSERT INTO documenso_webhook_events (id, documenso_id, type, payload, processed, received_at)
       VALUES (gen_random_uuid(), $1, $2, $3, false, now())`,
      [documensoId, event.event, JSON.stringify(event)],
    );

    const res = await postSigned(event);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    // Contract was updated
    expect(mockUpdateStatus).toHaveBeenCalled();

    // Event now marked processed
    const db = adminDb();
    const [row] = await db
      .select()
      .from(documensoWebhookEvents)
      .where(eq(documensoWebhookEvents.documensoId, documensoId));
    expect(row.processed).toBe(true);
  });

  // ---- Unknown event type ----

  it('unknown event type → processed, no contract update', async () => {
    const event = createUnknownEvent({ event: 'DOCUMENT_VIEWED' });
    const res = await postSigned(event);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    expect(mockGetByDocumensoDocumentId).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  // ---- Zod payload validation ----

  it('invalid payload structure (missing documentId) → 400', async () => {
    const invalidPayload = { event: 'DOCUMENT_SIGNED', data: {} };
    const body = JSON.stringify(invalidPayload);
    const sig = signPayload(body, WEBHOOK_SECRET);

    const res = await postDocumenso(body, sig);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_payload' });

    // No idempotency row created (rejected before insert)
    const db = adminDb();
    const events = await db.select().from(documensoWebhookEvents);
    expect(events).toHaveLength(0);
  });

  it('invalid payload structure (missing data object) → 400', async () => {
    const invalidPayload = { event: 'DOCUMENT_SIGNED' };
    const body = JSON.stringify(invalidPayload);
    const sig = signPayload(body, WEBHOOK_SECRET);

    const res = await postDocumenso(body, sig);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_payload' });
  });

  // ---- Signature verification ----

  it('invalid signature → 401', async () => {
    const event = createDocumentSignedEvent();
    const body = JSON.stringify(event);

    const res = await postDocumenso(body, 'bad-signature-hex');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('missing x-documenso-signature header → 401', async () => {
    const event = createDocumentSignedEvent();
    const body = JSON.stringify(event);

    const res = await postDocumenso(body);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });

  // ---- Missing env config ----

  it('missing DOCUMENSO_WEBHOOK_SECRET → 401', async () => {
    // Build a separate app with no Documenso secret
    const noSecretApp = await buildWebhookApp({
      DOCUMENSO_WEBHOOK_SECRET: undefined,
    });

    try {
      const event = createDocumentSignedEvent();
      const body = JSON.stringify(event);
      const sig = signPayload(body, 'doesnt-matter');

      const res = await noSecretApp.inject({
        method: 'POST',
        url: '/webhooks/documenso',
        payload: body,
        headers: {
          'content-type': 'application/json',
          'x-documenso-signature': sig,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'invalid_signature' });
    } finally {
      await noSecretApp.close();
    }
  });

  // ---- Malformed JSON ----

  it('malformed JSON → 400', async () => {
    const badBody = '{not valid json';
    const sig = signPayload(badBody, WEBHOOK_SECRET);

    const res = await postDocumenso(badBody, sig);
    expect(res.statusCode).toBe(400);
    // Fastify's JSON parser rejects before the handler runs
    expect(res.json().statusCode ?? res.json().error).toBeTruthy();
  });
});
