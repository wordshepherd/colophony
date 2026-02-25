import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAssertHubMode = vi.fn();
const mockRegisterInstance = vi.fn();
const mockRefreshAttestation = vi.fn();
const mockRegisterFingerprint = vi.fn();
const mockLookupFingerprint = vi.fn();

vi.mock('../services/hub.service.js', () => ({
  hubService: {
    assertHubMode: (...args: unknown[]) => mockAssertHubMode(...args),
    registerInstance: (...args: unknown[]) => mockRegisterInstance(...args),
    refreshAttestation: (...args: unknown[]) => mockRefreshAttestation(...args),
    registerFingerprint: (...args: unknown[]) =>
      mockRegisterFingerprint(...args),
    lookupFingerprint: (...args: unknown[]) => mockLookupFingerprint(...args),
  },
  HubNotEnabledError: class extends Error {
    override name = 'HubNotEnabledError';
  },
  HubInvalidRegistrationTokenError: class extends Error {
    override name = 'HubInvalidRegistrationTokenError';
  },
  HubInstanceAlreadyRegisteredError: class extends Error {
    override name = 'HubInstanceAlreadyRegisteredError';
  },
  HubInstanceSuspendedError: class extends Error {
    override name = 'HubInstanceSuspendedError';
  },
}));

vi.mock('./hub-auth.js', () => ({
  default: async () => {
    /* no-op for test */
  },
}));

// Minimal Fastify mock
type AnyFn = (...args: any[]) => any;

function createMockApp() {
  const routes: Record<string, AnyFn> = {};

  return {
    post: (path: string, handler: AnyFn) => {
      routes[`POST ${path}`] = handler;
    },
    get: (path: string, handler: AnyFn) => {
      routes[`GET ${path}`] = handler;
    },
    register: async (fn: AnyFn) => {
      // Execute the scope registration function
      const innerScope = createMockApp();
      await fn(innerScope);
      // Merge inner routes
      Object.assign(routes, innerScope._routes);
    },
    addHook: vi.fn(),
    _routes: routes,
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

describe('hub.routes', () => {
  let app: ReturnType<typeof createMockApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createMockApp();
    const { registerHubRoutes } = await import('./hub.routes.js');
    await registerHubRoutes(app as any, {
      env: { FEDERATION_ENABLED: true } as any,
    });
  });

  describe('POST /federation/v1/hub/register', () => {
    it('returns 200 on valid registration', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockRegisterInstance.mockResolvedValueOnce({
        instanceId: '00000000-0000-0000-0000-000000000001',
        attestationToken: 'jwt-token',
        attestationExpiresAt: '2026-03-25T00:00:00Z',
        hubDomain: 'hub.example.com',
        hubPublicKey: 'public-key',
      });

      const handler = app.getHandler('POST', '/federation/v1/hub/register');
      const reply = mockReply();
      await handler(
        {
          body: {
            domain: 'new.example.com',
            instanceUrl: 'https://new.example.com',
            publicKey: 'key',
            keyId: 'new.example.com#main',
            registrationToken: 'token',
            protocolVersion: '1.0',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(200);
      expect(reply.body.instanceId).toBeDefined();
    });

    it('returns 401 on invalid token', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);

      const { HubInvalidRegistrationTokenError } =
        await import('../services/hub.service.js');
      mockRegisterInstance.mockRejectedValueOnce(
        new HubInvalidRegistrationTokenError(),
      );

      const handler = app.getHandler('POST', '/federation/v1/hub/register');
      const reply = mockReply();
      await handler(
        {
          body: {
            domain: 'new.example.com',
            instanceUrl: 'https://new.example.com',
            publicKey: 'key',
            keyId: 'new.example.com#main',
            registrationToken: 'bad',
            protocolVersion: '1.0',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(401);
      expect(reply.body.error).toBe('invalid_registration_token');
    });

    it('returns 409 on duplicate registration', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);

      const { HubInstanceAlreadyRegisteredError } =
        await import('../services/hub.service.js');
      mockRegisterInstance.mockRejectedValueOnce(
        new HubInstanceAlreadyRegisteredError('dup.example.com'),
      );

      const handler = app.getHandler('POST', '/federation/v1/hub/register');
      const reply = mockReply();
      await handler(
        {
          body: {
            domain: 'dup.example.com',
            instanceUrl: 'https://dup.example.com',
            publicKey: 'key',
            keyId: 'dup.example.com#main',
            registrationToken: 'token',
            protocolVersion: '1.0',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(409);
      expect(reply.body.error).toBe('instance_already_registered');
    });
  });

  describe('POST /federation/v1/hub/fingerprints/register', () => {
    it('returns 200 with valid fingerprint registration', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockRegisterFingerprint.mockResolvedValueOnce(undefined);

      const handler = app.getHandler(
        'POST',
        '/federation/v1/hub/fingerprints/register',
      );
      const reply = mockReply();
      await handler(
        {
          body: {
            fingerprint: 'abc123',
            submitterDid: 'did:web:test:users:alice',
          },
          hubPeer: {
            domain: 'source.example.com',
            keyId: 'key',
            instanceId: 'id',
          },
        },
        reply,
      );

      expect(reply.statusCode).toBe(200);
      expect(reply.body.status).toBe('registered');
    });
  });

  describe('POST /federation/v1/hub/fingerprints/lookup', () => {
    it('returns conflicts on lookup', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockLookupFingerprint.mockResolvedValueOnce({
        found: true,
        conflicts: [
          {
            sourceDomain: 'b.example.com',
            publicationName: 'Test',
            submittedAt: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const handler = app.getHandler(
        'POST',
        '/federation/v1/hub/fingerprints/lookup',
      );
      const reply = mockReply();
      await handler(
        {
          body: {
            fingerprint: 'abc123',
            submitterDid: 'did:web:a:users:alice',
            requestingDomain: 'a.example.com',
          },
          hubPeer: { domain: 'a.example.com', keyId: 'key', instanceId: 'id' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(200);
      expect(reply.body.found).toBe(true);
      expect(reply.body.conflicts).toHaveLength(1);
    });

    it('excludes requesting domain from results', async () => {
      mockAssertHubMode.mockResolvedValueOnce(undefined);
      mockLookupFingerprint.mockResolvedValueOnce({
        found: false,
        conflicts: [],
      });

      const handler = app.getHandler(
        'POST',
        '/federation/v1/hub/fingerprints/lookup',
      );
      const reply = mockReply();
      await handler(
        {
          body: {
            fingerprint: 'abc123',
            submitterDid: 'did:web:a:users:alice',
            requestingDomain: 'a.example.com',
          },
          hubPeer: { domain: 'a.example.com', keyId: 'key', instanceId: 'id' },
        },
        reply,
      );

      expect(reply.statusCode).toBe(200);
      expect(reply.body.found).toBe(false);
    });
  });
});
