import { describe, it, expect, vi } from 'vitest';

let mockConnectShouldFail = false;

vi.mock('ioredis', () => {
  class MockRedis {
    connect = vi.fn().mockImplementation(async () => {
      if (mockConnectShouldFail) throw new Error('ECONNREFUSED');
    });
    subscribe = vi.fn().mockResolvedValue(undefined);
    unsubscribe = vi.fn().mockResolvedValue(undefined);
    quit = vi.fn().mockResolvedValue('OK');
    on = vi.fn();
  }
  return { default: MockRedis };
});

vi.mock('../redis-pubsub.js', () => ({
  channelKey: vi.fn().mockReturnValue('notifications:org-1:user-1'),
  trackConnection: vi.fn(),
  untrackConnection: vi.fn(),
}));

import { registerNotificationStreamRoute } from '../notification-stream.js';

function createTestHarness() {
  const mockGet = vi.fn();
  const mockApp = { get: mockGet } as any;
  const mockEnv = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    CORS_ORIGIN: 'http://localhost:3000',
  } as any;
  return { mockGet, mockApp, mockEnv };
}

describe('registerNotificationStreamRoute', () => {
  it('registers a GET route at /api/notifications/stream', async () => {
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });
    expect(mockGet).toHaveBeenCalledWith(
      '/api/notifications/stream',
      expect.any(Function),
    );
  });

  it('returns 401 when no auth context', async () => {
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });

    const handler = mockGet.mock.calls[0][1];
    const mockRequest = { authContext: null };
    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockRequest, mockReply);
    expect(mockReply.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when no org context', async () => {
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });

    const handler = mockGet.mock.calls[0][1];
    const mockRequest = { authContext: { userId: 'user-1', orgId: null } };
    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockRequest, mockReply);
    expect(mockReply.status).toHaveBeenCalledWith(400);
  });

  it('returns 429 when user exceeds max SSE connections', async () => {
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });

    const handler = mockGet.mock.calls[0][1];

    // Exhaust 5 connection slots for this user
    for (let i = 0; i < 5; i++) {
      const req = {
        authContext: { userId: 'user-flood', orgId: 'org-1' },
        headers: { origin: 'http://localhost:3000' },
        raw: { on: vi.fn() },
      };
      const rep = {
        hijack: vi.fn(),
        raw: { writeHead: vi.fn(), write: vi.fn(), end: vi.fn() },
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
      await handler(req, rep);
    }

    // 6th connection should be rejected
    const mockRequest = {
      authContext: { userId: 'user-flood', orgId: 'org-1' },
      raw: { on: vi.fn() },
    };
    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockRequest, mockReply);
    expect(mockReply.status).toHaveBeenCalledWith(429);
  });

  it('ends response gracefully when Redis connect fails', async () => {
    mockConnectShouldFail = true;
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });

    const handler = mockGet.mock.calls[0][1];
    const rawEnd = vi.fn();
    const mockRequest = {
      authContext: { userId: 'user-redis-fail', orgId: 'org-1' },
      headers: { origin: 'http://localhost:3000' },
      raw: { on: vi.fn() },
    };
    const mockReply = {
      hijack: vi.fn(),
      raw: { writeHead: vi.fn(), write: vi.fn(), end: rawEnd },
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockRequest, mockReply);
    expect(rawEnd).toHaveBeenCalled();

    // Reset for other tests
    mockConnectShouldFail = false;
  });

  it('includes CORS headers in hijacked SSE response', async () => {
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });

    const handler = mockGet.mock.calls[0][1];
    const writeHead = vi.fn();
    const mockRequest = {
      authContext: { userId: 'user-cors', orgId: 'org-1' },
      headers: { origin: 'http://localhost:3000' },
      raw: { on: vi.fn() },
    };
    const mockReply = {
      hijack: vi.fn(),
      raw: { writeHead, write: vi.fn(), end: vi.fn() },
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockRequest, mockReply);
    expect(writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
      }),
    );
  });

  it('omits CORS headers when origin is not allowed', async () => {
    const { mockGet, mockApp, mockEnv } = createTestHarness();
    await registerNotificationStreamRoute(mockApp, { env: mockEnv });

    const handler = mockGet.mock.calls[0][1];
    const writeHead = vi.fn();
    const mockRequest = {
      authContext: { userId: 'user-cors-bad', orgId: 'org-1' },
      headers: { origin: 'http://evil.example.com' },
      raw: { on: vi.fn() },
    };
    const mockReply = {
      hijack: vi.fn(),
      raw: { writeHead, write: vi.fn(), end: vi.fn() },
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockRequest, mockReply);
    const headers = writeHead.mock.calls[0][1];
    expect(headers).not.toHaveProperty('Access-Control-Allow-Origin');
  });
});
