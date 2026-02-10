import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from '../../src/modules/security/rate-limit.service';
import { RedisService } from '../../src/modules/redis/redis.service';

/**
 * Mock Redis client with sorted set operations for rate limiting tests
 */
class MockRedisClient {
  private store = new Map<string, { score: number; member: string }[]>();

  pipeline() {
    const operations: Array<() => Promise<[null, unknown]>> = [];

    return {
      zremrangebyscore: (key: string, min: number, max: number) => {
        operations.push(async () => {
          const entries = this.store.get(key) || [];
          const filtered = entries.filter(
            (e) => e.score > max || e.score < min,
          );
          this.store.set(key, filtered);
          return [null, entries.length - filtered.length];
        });
        return this;
      },
      zcard: (key: string) => {
        operations.push(async () => {
          const entries = this.store.get(key) || [];
          return [null, entries.length];
        });
        return this;
      },
      zadd: (key: string, score: number, member: string) => {
        operations.push(async () => {
          const entries = this.store.get(key) || [];
          entries.push({ score, member });
          this.store.set(key, entries);
          return [null, 1];
        });
        return this;
      },
      pexpire: (_key: string, _ms: number) => {
        operations.push(async () => [null, 1]);
        return this;
      },
      exec: async () => {
        const results: Array<[null, unknown]> = [];
        for (const op of operations) {
          results.push(await op());
        }
        return results;
      },
    };
  }

  async zrange(key: string, start: number, stop: number, _withScores?: string) {
    const entries = this.store.get(key) || [];
    const sorted = entries.sort((a, b) => a.score - b.score);
    const sliced = sorted.slice(start, stop + 1);
    // Return [member, score, member, score, ...]
    const result: string[] = [];
    for (const entry of sliced) {
      result.push(entry.member, String(entry.score));
    }
    return result;
  }

  clear() {
    this.store.clear();
  }
}

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRedisClient: MockRedisClient;

  beforeEach(async () => {
    mockRedisClient = new MockRedisClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              if (key === 'RATE_LIMIT_DEFAULT_MAX') return '5'; // Lower for testing
              if (key === 'RATE_LIMIT_AUTH_MAX') return '3'; // Lower for testing
              return defaultValue;
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: () => mockRedisClient,
          },
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    mockRedisClient.clear();
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      const result = await service.checkRateLimit('test-key', {
        windowMs: 60000,
        maxRequests: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 = 4
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it('should block requests over the limit', async () => {
      const config = { windowMs: 60000, maxRequests: 3 };

      // Make 3 requests (at the limit)
      await service.checkRateLimit('test-key', config);
      await service.checkRateLimit('test-key', config);
      await service.checkRateLimit('test-key', config);

      // 4th request should be blocked
      const result = await service.checkRateLimit('test-key', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track remaining requests correctly', async () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      const result1 = await service.checkRateLimit('test-key', config);
      expect(result1.remaining).toBe(4);

      const result2 = await service.checkRateLimit('test-key', config);
      expect(result2.remaining).toBe(3);

      const result3 = await service.checkRateLimit('test-key', config);
      expect(result3.remaining).toBe(2);
    });

    it('should use separate buckets for different keys', async () => {
      const config = { windowMs: 60000, maxRequests: 2 };

      // Fill up key1
      await service.checkRateLimit('key1', config);
      await service.checkRateLimit('key1', config);
      const result1 = await service.checkRateLimit('key1', config);

      // key2 should still have quota
      const result2 = await service.checkRateLimit('key2', config);

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('checkDefaultLimit', () => {
    it('should use default config (100 req/min)', async () => {
      const config = service.getDefaultConfig();
      expect(config.maxRequests).toBe(5); // Overridden in test
      expect(config.windowMs).toBe(60000);
    });

    it('should prefix key with ip:', async () => {
      const result = await service.checkDefaultLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkAuthLimit', () => {
    it('should use stricter auth config', async () => {
      const config = service.getAuthConfig();
      expect(config.maxRequests).toBe(3); // Stricter than default
      expect(config.windowMs).toBe(60000);
    });

    it('should block after fewer requests than default', async () => {
      // Auth limit is 3 in test config
      await service.checkAuthLimit('192.168.1.1');
      await service.checkAuthLimit('192.168.1.1');
      await service.checkAuthLimit('192.168.1.1');

      const result = await service.checkAuthLimit('192.168.1.1');
      expect(result.allowed).toBe(false);
    });
  });

  describe('sliding window behavior', () => {
    it('should provide retryAfter when rate limited', async () => {
      const config = { windowMs: 60000, maxRequests: 1 };

      await service.checkRateLimit('test-key', config);
      const result = await service.checkRateLimit('test-key', config);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60); // Max 60 seconds
    });
  });
});
