/**
 * Scope and boundary enforcement across the routers closed by P0.1 / P0.1b.
 *
 * These assertions deliberately live outside `webhooks.spec.ts` and
 * `notifications.spec.ts`: those suites `vi.mock('../init.js')` with a
 * passthrough stub whose `.use()` is `mockReturnThis()`, so any scope
 * assertion written there would exercise a stub that discards the middleware
 * and pass regardless of what the routers declare. Here `../../init.js` is the
 * real module — only the service layer is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { envState } = vi.hoisted(() => ({
  envState: {
    TRPC_INTERNAL_ONLY_ENFORCE: false,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  },
}));

vi.mock('../../../config/env.js', () => ({
  validateEnv: () => envState,
}));

vi.mock('@colophony/db', () => ({
  webhookEndpoints: { id: 'id', organizationId: 'organization_id' },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('../../../queues/webhook.queue.js', () => ({
  enqueueWebhook: vi.fn(),
}));

vi.mock('../../../services/webhook.service.js', () => ({
  webhookService: {
    listEndpoints: vi.fn(async () => ({ items: [], total: 0 })),
    getEndpoint: vi.fn(async () => null),
    listDeliveries: vi.fn(async () => ({ items: [], total: 0 })),
    rotateSecret: vi.fn(async () => ({ id: 'e1', secret: 'rotated' })),
    createEndpoint: vi.fn(async () => ({ id: 'e1' })),
  },
}));

vi.mock('../../../services/notification.service.js', () => ({
  notificationService: {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    unreadCount: vi.fn(async () => 0),
    markRead: vi.fn(async () => true),
    markAllRead: vi.fn(async () => 0),
  },
}));

vi.mock('../../../services/notification-preference.service.js', () => ({
  notificationPreferenceService: {
    listForUser: vi.fn(async () => []),
    upsert: vi.fn(async () => ({
      id: '00000000-0000-4000-a000-000000000900',
      organizationId: '00000000-0000-4000-a000-000000000010',
      userId: '00000000-0000-4000-a000-000000000001',
      channel: 'EMAIL',
      eventType: 'SUBMISSION_RECEIVED',
      enabled: true,
    })),
    bulkUpsert: vi.fn(async () => []),
  },
}));

vi.mock('../../../services/federation.service.js', () => ({
  federationService: {
    getPublicConfig: vi.fn(async () => ({ enabled: false })),
  },
}));

vi.mock('../../../services/trust.service.js', () => ({
  trustService: {},
}));

vi.mock('../../error-mapper.js', () => ({
  mapServiceError: vi.fn((e: unknown) => e),
}));

import { createRouter } from '../../init.js';
import type { TRPCContext } from '../../context.js';
import type { ApiKeyScope } from '@colophony/types';
import { webhooksRouter } from '../webhooks.js';
import { notificationsRouter } from '../notifications.js';
import { notificationPreferencesRouter } from '../notification-preferences.js';
import { federationRouter } from '../federation.js';

const USER_ID = '00000000-0000-4000-a000-000000000001';
const ORG_ID = '00000000-0000-4000-a000-000000000010';
const API_KEY_ID = '00000000-0000-4000-a000-0000000000ff';
const ENDPOINT_ID = '00000000-0000-4000-a000-000000000700';

const router = createRouter({
  webhooks: webhooksRouter,
  notifications: notificationsRouter,
  notificationPreferences: notificationPreferencesRouter,
  federation: federationRouter,
});

function baseContext(
  authContext: NonNullable<TRPCContext['authContext']>,
): TRPCContext {
  return {
    authContext,
    dbTx: {} as TRPCContext['dbTx'],
    audit: vi.fn(),
  };
}

/** An API key acting as an org ADMIN — roles come from the key's creator. */
function keyCaller(scopes: ApiKeyScope[]) {
  return (router as any).createCaller(
    baseContext({
      userId: USER_ID,
      email: 'key@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: API_KEY_ID,
      apiKeyScopes: scopes,
      orgId: ORG_ID,
      roles: ['ADMIN'],
    }),
  );
}

/** An interactive session with no scopes at all — how the web app calls in. */
function oidcCaller() {
  return (router as any).createCaller(
    baseContext({
      userId: USER_ID,
      email: 'human@example.com',
      emailVerified: true,
      authMethod: 'oidc',
      orgId: ORG_ID,
      roles: ['ADMIN'],
    }),
  );
}

describe('tRPC scope enforcement (P0.1b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.TRPC_INTERNAL_ONLY_ENFORCE = false;
  });

  describe('webhooks', () => {
    it('admits a read-scoped key to list', async () => {
      await expect(
        keyCaller(['webhooks:read']).webhooks.list({ page: 1, limit: 20 }),
      ).resolves.toEqual({ items: [], total: 0 });
    });

    it('denies rotateSecret to a read-scoped key', async () => {
      await expect(
        keyCaller(['webhooks:read']).webhooks.rotateSecret({
          id: ENDPOINT_ID,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('admits rotateSecret to a manage-scoped key', async () => {
      await expect(
        keyCaller(['webhooks:manage']).webhooks.rotateSecret({
          id: ENDPOINT_ID,
        }),
      ).resolves.toMatchObject({ id: 'e1' });
    });

    it('denies list to a key holding only an unrelated scope', async () => {
      await expect(
        keyCaller(['manuscripts:read']).webhooks.list({ page: 1, limit: 20 }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('notifications', () => {
    it('admits a read-scoped key to list', async () => {
      await expect(
        keyCaller(['notifications:read']).notifications.list({
          page: 1,
          limit: 20,
        }),
      ).resolves.toEqual({ items: [], total: 0 });
    });

    it('denies markRead to a read-scoped key', async () => {
      await expect(
        keyCaller(['notifications:read']).notifications.markRead({
          id: '00000000-0000-4000-a000-000000000800',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('denies preference writes to a read-scoped key', async () => {
      await expect(
        keyCaller(['notifications:read']).notificationPreferences.upsert({
          channel: 'EMAIL',
          eventType: 'SUBMISSION_RECEIVED',
          enabled: true,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('admits preference reads to a read-scoped key', async () => {
      await expect(
        keyCaller(['notifications:read']).notificationPreferences.list(),
      ).resolves.toEqual([]);
    });
  });

  describe('interactive sessions are unaffected', () => {
    it('lets an OIDC caller with no scopes rotate a webhook secret', async () => {
      await expect(
        oidcCaller().webhooks.rotateSecret({ id: ENDPOINT_ID }),
      ).resolves.toMatchObject({ id: 'e1' });
    });

    it('lets an OIDC caller with no scopes mark all notifications read', async () => {
      await expect(oidcCaller().notifications.markAllRead()).resolves.toEqual({
        count: 0,
      });
    });
  });

  // The two halves of the fix meeting: scopes cover the routers that get a REST
  // equivalent, internalOnly covers the ones that never will. Either alone
  // leaves a way in.
  describe('internal-only routers (P0.1)', () => {
    // Enforcement is the default since 2026-07-27; this covers the revert
    // path, not pending behaviour.
    it('lets an API key reach federation when explicitly set to log-only', async () => {
      envState.TRPC_INTERNAL_ONLY_ENFORCE = false;

      await expect(
        keyCaller(['manuscripts:read']).federation.getConfig(),
      ).resolves.toBeDefined();
    });

    it('denies an API key once enforcing, whatever scopes it holds', async () => {
      envState.TRPC_INTERNAL_ONLY_ENFORCE = true;

      await expect(
        keyCaller(['manuscripts:read']).federation.getConfig(),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('still admits an interactive session when enforcing', async () => {
      envState.TRPC_INTERNAL_ONLY_ENFORCE = true;

      await expect(oidcCaller().federation.getConfig()).resolves.toBeDefined();
    });
  });
});
