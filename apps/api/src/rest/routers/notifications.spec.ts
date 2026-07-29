import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

vi.mock('../../services/notification.service.js', () => ({
  notificationService: {
    create: vi.fn(),
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('../../services/notification-preference.service.js', () => ({
  notificationPreferenceService: {
    isEmailEnabled: vi.fn(),
    isInAppEnabled: vi.fn(),
    listForUser: vi.fn(),
    upsert: vi.fn(),
    bulkUpsert: vi.fn(),
  },
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  notificationsInbox: {},
  notificationPreferences: {},
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}));

import { notificationService } from '../../services/notification.service.js';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { notificationsRouter } from './notifications.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockNotifications = vi.mocked(notificationService);
const mockPreferences = vi.mocked(notificationPreferenceService);

const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const NOTIF_ID = 'c0000000-0000-4000-a000-000000000001';
const PREF_ID = 'd0000000-0000-4000-a000-000000000001';

function baseContext(): RestContext {
  return { authContext: null, dbTx: null, audit: vi.fn() };
}

/** Authenticated but with no organization resolved. */
function authedContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'writer@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function orgContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'writer@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      roles: ['READER'],
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function apiKeyContext(scopes: string[]): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'writer@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as never,
      orgId: ORG_ID,
      roles: ['READER'],
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as never, { context }) as (
    input?: unknown,
  ) => Promise<never>;
}

function notificationRow() {
  return {
    id: NOTIF_ID,
    eventType: 'submission.received',
    title: 'New submission',
    body: 'A body',
    link: '/submissions/1',
    readAt: null,
    createdAt: new Date(),
  };
}

function preferenceRow() {
  return {
    id: PREF_ID,
    channel: 'email' as const,
    eventType: 'submission.received',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Every route, for the blanket auth and org-context cases. */
const ALL_ROUTES: Array<[string, unknown, unknown]> = [
  ['list', notificationsRouter.list, { page: 1, limit: 20 }],
  ['unreadCount', notificationsRouter.unreadCount, undefined],
  ['markRead', notificationsRouter.markRead, { id: NOTIF_ID }],
  ['markAllRead', notificationsRouter.markAllRead, undefined],
  ['listPreferences', notificationsRouter.listPreferences, undefined],
  [
    'upsertPreference',
    notificationsRouter.upsertPreference,
    { channel: 'email', eventType: 'submission.received', enabled: true },
  ],
  [
    'bulkUpsertPreferences',
    notificationsRouter.bulkUpsertPreferences,
    {
      preferences: [
        { channel: 'email', eventType: 'submission.received', enabled: false },
      ],
    },
  ],
];

describe('notifications REST router', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: this suite runs under vitest's random
    // sequencing, and `clearAllMocks` leaves queued `mockResolvedValueOnce`
    // implementations in place. One test would then consume a value another
    // queued, and which one depends on the seed — a failure that reproduces
    // only on some runs.
    vi.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth and org context, across the whole router
  // -------------------------------------------------------------------------

  describe.each(ALL_ROUTES)('%s', (_name, procedure, input) => {
    it('requires auth', async () => {
      await expect(client(procedure, baseContext())(input)).rejects.toThrow(
        ORPCError,
      );
    });

    it('requires org context', async () => {
      await expect(client(procedure, authedContext())(input)).rejects.toThrow(
        'X-Organization-Id header is required',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /notifications
  // -------------------------------------------------------------------------

  describe('GET /notifications (list)', () => {
    it('returns the paginated envelope', async () => {
      mockNotifications.list.mockResolvedValueOnce({
        items: [notificationRow()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const result = await client(
        notificationsRouter.list,
        orgContext(),
      )({ page: 1, limit: 20 });

      expect(result).toMatchObject({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect((result as { items: unknown[] }).items).toHaveLength(1);
    });

    it('passes the org id through as the third argument', async () => {
      // A dropped org argument silently widens the query to RLS alone, so this
      // asserts the full call rather than a prefix of it.
      mockNotifications.list.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });

      await client(
        notificationsRouter.list,
        orgContext(),
      )({ page: 2, limit: 5, unreadOnly: true });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockNotifications.list).toHaveBeenCalledWith(
        expect.anything(),
        { userId: USER_ID, unreadOnly: true, page: 2, limit: 5 },
        ORG_ID,
      );
    });

    it('parses unreadOnly=false as false, not as a truthy string', async () => {
      // z.coerce.boolean() would make "false" true here, inverting the filter.
      mockNotifications.list.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await client(
        notificationsRouter.list,
        orgContext(),
      )({ page: '1', limit: '20', unreadOnly: 'false' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockNotifications.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ unreadOnly: false }),
        ORG_ID,
      );
    });

    it('rejects a limit above the 50 the service accepts', async () => {
      await expect(
        client(notificationsRouter.list, orgContext())({ page: 1, limit: 100 }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /notifications/unread-count
  // -------------------------------------------------------------------------

  describe('GET /notifications/unread-count', () => {
    it('returns the count and passes the org id', async () => {
      mockNotifications.unreadCount.mockResolvedValueOnce(7);

      const result = await client(
        notificationsRouter.unreadCount,
        orgContext(),
      )();

      expect(result).toEqual({ count: 7 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockNotifications.unreadCount).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        ORG_ID,
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /notifications/{id}/read
  // -------------------------------------------------------------------------

  describe('POST /notifications/{id}/read', () => {
    it('marks read, audits, and passes all four arguments', async () => {
      mockNotifications.markRead.mockResolvedValueOnce(true);
      const ctx = orgContext();

      const result = await client(
        notificationsRouter.markRead,
        ctx,
      )({ id: NOTIF_ID });

      expect(result).toEqual({ success: true });
      // markRead takes (tx, id, userId, orgId) — a three-argument assertion
      // would pass vacuously and miss exactly the dropped org id being tested.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockNotifications.markRead).toHaveBeenCalledWith(
        expect.anything(),
        NOTIF_ID,
        USER_ID,
        ORG_ID,
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'IN_APP_NOTIFICATION_READ',
          resource: 'notification_inbox',
          resourceId: NOTIF_ID,
        }),
      );
    });

    it('does not audit when nothing matched', async () => {
      mockNotifications.markRead.mockResolvedValueOnce(false);
      const ctx = orgContext();

      const result = await client(
        notificationsRouter.markRead,
        ctx,
      )({ id: NOTIF_ID });

      expect(result).toEqual({ success: false });
      expect(ctx.audit).not.toHaveBeenCalled();
    });

    it('rejects a non-uuid id', async () => {
      await expect(
        client(
          notificationsRouter.markRead,
          orgContext(),
        )({ id: 'not-a-uuid' }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // POST /notifications/read-all
  // -------------------------------------------------------------------------

  describe('POST /notifications/read-all', () => {
    it('returns the count, audits, and passes the org id', async () => {
      mockNotifications.markAllRead.mockResolvedValueOnce(3);
      const ctx = orgContext();

      const result = await client(notificationsRouter.markAllRead, ctx)();

      expect(result).toEqual({ count: 3 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockNotifications.markAllRead).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        ORG_ID,
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'IN_APP_NOTIFICATION_ALL_READ',
          resource: 'notification_inbox',
          newValue: { count: 3 },
        }),
      );
    });

    it('does not audit when nothing was unread', async () => {
      mockNotifications.markAllRead.mockResolvedValueOnce(0);
      const ctx = orgContext();

      const result = await client(notificationsRouter.markAllRead, ctx)();

      expect(result).toEqual({ count: 0 });
      expect(ctx.audit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  describe('GET /notification-preferences', () => {
    it('returns the bare array and passes org then user', async () => {
      mockPreferences.listForUser.mockResolvedValueOnce([
        preferenceRow(),
      ] as never);

      const result = await client(
        notificationsRouter.listPreferences,
        orgContext(),
      )();

      expect(result).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockPreferences.listForUser).toHaveBeenCalledWith(
        expect.anything(),
        ORG_ID,
        USER_ID,
      );
    });
  });

  describe('PUT /notification-preferences', () => {
    it('upserts, audits, and binds the org and user from context', async () => {
      mockPreferences.upsert.mockResolvedValueOnce(preferenceRow() as never);
      const ctx = orgContext();

      const result = await client(
        notificationsRouter.upsertPreference,
        ctx,
      )({ channel: 'email', eventType: 'submission.received', enabled: true });

      expect(result).toMatchObject({ id: PREF_ID, enabled: true });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockPreferences.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: ORG_ID,
          userId: USER_ID,
          channel: 'email',
          eventType: 'submission.received',
          enabled: true,
        }),
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_PREFERENCE_UPDATED',
          resource: 'notification_preference',
          resourceId: PREF_ID,
        }),
      );
    });

    it('rejects an event type outside the enum', async () => {
      await expect(
        client(
          notificationsRouter.upsertPreference,
          orgContext(),
        )({ channel: 'email', eventType: 'not.a.real.event', enabled: true }),
      ).rejects.toThrow();
    });
  });

  describe('PUT /notification-preferences/batch', () => {
    it('bulk upserts and audits the count', async () => {
      mockPreferences.bulkUpsert.mockResolvedValueOnce([
        preferenceRow(),
      ] as never);
      const ctx = orgContext();

      const preferences = [
        { channel: 'email', eventType: 'submission.received', enabled: false },
      ];
      await client(
        notificationsRouter.bulkUpsertPreferences,
        ctx,
      )({
        preferences,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockPreferences.bulkUpsert).toHaveBeenCalledWith(
        expect.anything(),
        ORG_ID,
        USER_ID,
        preferences,
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_PREFERENCE_UPDATED',
          newValue: { count: 1 },
        }),
      );
    });

    it('rejects an empty batch', async () => {
      await expect(
        client(
          notificationsRouter.bulkUpsertPreferences,
          orgContext(),
        )({ preferences: [] }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies a key holding an unrelated scope', async () => {
      await expect(
        client(
          notificationsRouter.list,
          apiKeyContext(['submissions:read']),
        )({ page: 1, limit: 20 }),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('allows notifications:read on a read route', async () => {
      mockNotifications.unreadCount.mockResolvedValueOnce(0);

      const result = await client(
        notificationsRouter.unreadCount,
        apiKeyContext(['notifications:read']),
      )();

      expect(result).toEqual({ count: 0 });
    });

    it('does not let notifications:read satisfy a write route', async () => {
      // Read must not imply write. If these two ever collapse into one scope,
      // this is the test that should stop it.
      await expect(
        client(
          notificationsRouter.markAllRead,
          apiKeyContext(['notifications:read']),
        )(),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('allows notifications:write on a write route', async () => {
      mockNotifications.markAllRead.mockResolvedValueOnce(2);

      const result = await client(
        notificationsRouter.markAllRead,
        apiKeyContext(['notifications:write']),
      )();

      expect(result).toEqual({ count: 2 });
    });

    it('does not let notifications:write satisfy a read route', async () => {
      await expect(
        client(
          notificationsRouter.listPreferences,
          apiKeyContext(['notifications:write']),
        )(),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('bypasses scopes for interactive auth', async () => {
      // requireScopes is a no-op for anything that is not an API key, which is
      // what keeps the web app working without granting it scopes.
      mockNotifications.markAllRead.mockResolvedValueOnce(1);

      const result = await client(
        notificationsRouter.markAllRead,
        orgContext(),
      )();

      expect(result).toEqual({ count: 1 });
    });
  });
});
