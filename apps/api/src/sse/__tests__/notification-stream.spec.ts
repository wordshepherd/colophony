import { describe, it, expect, vi } from 'vitest';

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
  }));
  return { default: MockRedis };
});

vi.mock('../redis-pubsub.js', () => ({
  channelKey: vi.fn().mockReturnValue('notifications:org-1:user-1'),
  trackConnection: vi.fn(),
  untrackConnection: vi.fn(),
}));

import { registerNotificationStreamRoute } from '../notification-stream.js';

describe('registerNotificationStreamRoute', () => {
  it('registers a GET route at /api/notifications/stream', async () => {
    const mockGet = vi.fn();
    const mockApp = { get: mockGet } as any;
    const mockEnv = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    } as any;

    await registerNotificationStreamRoute(mockApp, { env: mockEnv });
    expect(mockGet).toHaveBeenCalledWith(
      '/api/notifications/stream',
      expect.any(Function),
    );
  });

  it('returns 401 when no auth context', async () => {
    const mockGet = vi.fn();
    const mockApp = { get: mockGet } as any;
    const mockEnv = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    } as any;

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
    const mockGet = vi.fn();
    const mockApp = { get: mockGet } as any;
    const mockEnv = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    } as any;

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
});
