import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAssertHubMode = vi.fn();
const mockListInstances = vi.fn();
const mockGetInstanceById = vi.fn();
const mockSuspendInstance = vi.fn();
const mockRevokeInstance = vi.fn();

vi.mock('../services/hub.service.js', () => ({
  hubService: {
    assertHubMode: (...args: unknown[]) => mockAssertHubMode(...args),
    listInstances: (...args: unknown[]) => mockListInstances(...args),
    getInstanceById: (...args: unknown[]) => mockGetInstanceById(...args),
    suspendInstance: (...args: unknown[]) => mockSuspendInstance(...args),
    revokeInstance: (...args: unknown[]) => mockRevokeInstance(...args),
  },
  HubNotEnabledError: class extends Error {
    override name = 'HubNotEnabledError';
  },
  HubInstanceNotFoundError: class extends Error {
    override name = 'HubInstanceNotFoundError';
  },
}));

type AnyFn = (...args: any[]) => any;

// Minimal Fastify mock
function createMockApp() {
  const routes: Record<string, AnyFn> = {};
  let preHandler: AnyFn | null = null;

  return {
    post: (path: string, handler: AnyFn) => {
      routes[`POST ${path}`] = handler;
    },
    get: (path: string, handler: AnyFn) => {
      routes[`GET ${path}`] = handler;
    },
    addHook: (_name: string, fn: AnyFn) => {
      preHandler = fn;
    },
    register: vi.fn(),
    _routes: routes,
    _preHandler: () => preHandler,
    getHandler: (method: string, path: string) => routes[`${method} ${path}`],
  };
}

function mockReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
    status: (code: number) => {
      reply.statusCode = code;
      return reply;
    },
    send: (body: unknown) => {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hub-admin.routes', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createMockApp();
    const { registerHubAdminRoutes } = await import('./hub-admin.routes.js');
    await registerHubAdminRoutes(app as any, {
      env: { FEDERATION_ENABLED: true } as any,
    });
  });

  describe('GET /federation/hub/instances', () => {
    it('lists active instances', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockListInstances.mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000001',
          domain: 'instance.example.com',
          instanceUrl: 'https://instance.example.com',
          status: 'active',
          lastSeenAt: null,
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const handler = app.getHandler('GET', '/federation/hub/instances');
      const reply = mockReply();
      await handler(
        { query: {}, authContext: { role: 'ADMIN', userId: 'user' } },
        reply,
      );

      expect(reply.body).toHaveLength(1);
      expect(reply.body[0].domain).toBe('instance.example.com');
    });
  });

  describe('POST /federation/hub/instances/:id/suspend', () => {
    it('suspends instance', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockSuspendInstance.mockResolvedValueOnce(undefined);

      const handler = app.getHandler(
        'POST',
        '/federation/hub/instances/:id/suspend',
      );
      const reply = mockReply();
      await handler(
        {
          params: { id: 'a0000000-0000-4000-8000-000000000001' },
          authContext: { role: 'ADMIN', userId: 'admin-user' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(200);
      expect(reply.body.status).toBe('suspended');
    });
  });

  describe('POST /federation/hub/instances/:id/revoke', () => {
    it('revokes instance', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockRevokeInstance.mockResolvedValueOnce(undefined);

      const handler = app.getHandler(
        'POST',
        '/federation/hub/instances/:id/revoke',
      );
      const reply = mockReply();
      await handler(
        {
          params: { id: 'a0000000-0000-4000-8000-000000000001' },
          authContext: { role: 'ADMIN', userId: 'admin-user' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(200);
      expect(reply.body.status).toBe('revoked');
    });
  });

  describe('hub mode guard', () => {
    it('returns 404 when hub mode not active', async () => {
      const { HubNotEnabledError } = await import('../services/hub.service.js');
      mockAssertHubMode.mockRejectedValueOnce(new HubNotEnabledError());

      const handler = app.getHandler('GET', '/federation/hub/instances');
      const reply = mockReply();
      await handler(
        { query: {}, authContext: { role: 'ADMIN', userId: 'user' } },
        reply,
      );

      expect(reply.statusCode).toBe(404);
      expect(reply.body.error).toBe('hub_not_enabled');
    });
  });
});
