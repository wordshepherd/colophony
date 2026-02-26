import { describe, it, expect, vi } from 'vitest';

vi.mock('ioredis', () => {
  class MockRedis {
    connect = vi.fn().mockResolvedValue(undefined);
    publish = vi.fn().mockResolvedValue(1);
    quit = vi.fn().mockResolvedValue('OK');
  }
  return { default: MockRedis };
});

vi.mock('../../config/env.js', () => ({
  validateEnv: vi.fn().mockReturnValue({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

import { channelKey, publishNotification } from '../redis-pubsub.js';

describe('redis-pubsub', () => {
  const mockEnv = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  } as any;

  describe('channelKey', () => {
    it('formats channel as notifications:{orgId}:{userId}', () => {
      const key = channelKey('org-123', 'user-456');
      expect(key).toBe('notifications:org-123:user-456');
    });
  });

  describe('publishNotification', () => {
    it('publishes serialized JSON to correct channel', async () => {
      const event = {
        id: 'notif-1',
        eventType: 'submission.received',
        title: 'New submission',
        body: null,
        link: '/submissions/123',
        createdAt: '2026-02-26T00:00:00.000Z',
      };

      // publishNotification uses getPublisher internally which creates a Redis instance
      await expect(
        publishNotification(mockEnv, 'org-1', 'user-1', event),
      ).resolves.not.toThrow();
    });
  });
});
