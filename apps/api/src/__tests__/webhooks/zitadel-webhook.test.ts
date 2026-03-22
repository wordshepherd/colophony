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
import { users, zitadelWebhookEvents, auditEvents } from '@colophony/db';
import {
  globalSetup,
  globalTeardown,
  getAdminPool,
} from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { createUser } from '../rls/helpers/factories';
import { buildWebhookApp } from './helpers/webhook-app';
import { createZitadelPayload } from './helpers/zitadel-fixtures';

// Mock only verifyZitadelSignature, preserving real schema exports
vi.mock('@colophony/auth-client', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@colophony/auth-client')>();
  return {
    ...original,
    verifyZitadelSignature: vi.fn().mockReturnValue(true),
  };
});

// Import the mock so we can manipulate it per-test
import { verifyZitadelSignature } from '@colophony/auth-client';
const mockVerifySignature = vi.mocked(verifyZitadelSignature);

function adminDb() {
  return drizzle(getAdminPool());
}

describe('Zitadel webhook integration', () => {
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
    mockVerifySignature.mockReturnValue(true);
  });

  async function postZitadel(payload: unknown) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      payload: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': 'valid-test-signature',
      },
    });
  }

  it('user.created → user record created + USER_CREATED audit', async () => {
    const payload = createZitadelPayload({ eventType: 'user.human.added' });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, payload.aggregateID));
    expect(user).toBeDefined();
    expect(user.email).toBe(payload.event_payload.email);
    expect(user.emailVerified).toBe(false);

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'USER_CREATED'));
    expect(audit).toBeDefined();
  });

  it('user.changed → user updated + USER_UPDATED audit', async () => {
    const zitadelUserId = 'zitadel-user-for-change-test';
    await createUser({ zitadelUserId, email: 'old@example.com' });

    const payload = createZitadelPayload({
      eventType: 'user.human.changed',
      userId: zitadelUserId,
      email: 'new@example.com',
    });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId));
    expect(user.email).toBe('new@example.com');

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'USER_UPDATED'));
    expect(audit).toBeDefined();
  });

  it('user.deactivated → deletedAt set + USER_DEACTIVATED audit', async () => {
    const zitadelUserId = 'zitadel-user-for-deactivate-test';
    await createUser({ zitadelUserId });

    const payload = createZitadelPayload({
      eventType: 'user.deactivated',
      userId: zitadelUserId,
    });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId));
    expect(user.deletedAt).not.toBeNull();

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'USER_DEACTIVATED'));
    expect(audit).toBeDefined();
  });

  it('user.reactivated → deletedAt cleared + USER_REACTIVATED audit', async () => {
    const zitadelUserId = 'zitadel-user-for-reactivate-test';
    await createUser({ zitadelUserId, deletedAt: new Date() });

    const payload = createZitadelPayload({
      eventType: 'user.reactivated',
      userId: zitadelUserId,
    });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId));
    expect(user.deletedAt).toBeNull();

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'USER_REACTIVATED'));
    expect(audit).toBeDefined();
  });

  it('user.removed → GDPR anonymization + USER_REMOVED audit', async () => {
    const zitadelUserId = 'zitadel-user-for-removal-test';
    await createUser({
      zitadelUserId,
      email: 'real@example.com',
      emailVerified: true,
    });

    const payload = createZitadelPayload({
      eventType: 'user.removed',
      userId: zitadelUserId,
    });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId));
    expect(user.email).toBe(`deleted-${zitadelUserId}@anonymized.local`);
    expect(user.emailVerified).toBe(false);
    expect(user.deletedAt).not.toBeNull();

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'USER_REMOVED'));
    expect(audit).toBeDefined();
  });

  it('user.email.verified → emailVerified=true + USER_EMAIL_VERIFIED audit', async () => {
    const zitadelUserId = 'zitadel-user-for-email-verify-test';
    await createUser({ zitadelUserId, emailVerified: false });

    const payload = createZitadelPayload({
      eventType: 'user.human.email.verified',
      userId: zitadelUserId,
    });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId));
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerifiedAt).not.toBeNull();

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'USER_EMAIL_VERIFIED'));
    expect(audit).toBeDefined();
  });

  it('idempotency: duplicate event_id → second returns already_processed', async () => {
    const payload = createZitadelPayload({ eventType: 'user.human.added' });

    const res1 = await postZitadel(payload);
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ status: 'processed' });

    const res2 = await postZitadel(payload);
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ status: 'already_processed' });

    const db = adminDb();
    const rows = await db
      .select()
      .from(zitadelWebhookEvents)
      .where(
        eq(
          zitadelWebhookEvents.eventId,
          `${payload.aggregateID}:${payload.sequence}`,
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it('out-of-order guard: stale event skipped', async () => {
    const zitadelUserId = 'zitadel-user-for-ooo-test';
    const futureTime = new Date(Date.now() + 60_000); // T2 (60s ahead)
    await createUser({
      zitadelUserId,
      email: 'current@example.com',
      lastEventAt: futureTime,
    });

    // Send an older event (T1) with creationDate before lastEventAt
    const pastTime = new Date(Date.now() - 10_000); // T1 (10s ago)
    const payload = createZitadelPayload({
      eventType: 'user.human.changed',
      userId: zitadelUserId,
      email: 'stale@example.com',
      creationDate: pastTime.toISOString(),
    });
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.zitadelUserId, zitadelUserId));
    // Email should NOT have been updated (stale event skipped)
    expect(user.email).toBe('current@example.com');
  });

  it('invalid signature → 401', async () => {
    mockVerifySignature.mockReturnValue(false);

    const payload = createZitadelPayload();
    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('stale timestamp → 400 (event_too_old)', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const payload = createZitadelPayload({
      creationDate: tenMinutesAgo.toISOString(),
    });

    const res = await postZitadel(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'event_too_old' });
  });
});
