import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMIT_PREFIX = 'ratelimit:';

@Injectable()
export class RateLimitService {
  private readonly defaultConfig: RateLimitConfig;
  private readonly authConfig: RateLimitConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Default: 100 requests per minute
    this.defaultConfig = {
      windowMs: 60 * 1000,
      maxRequests: parseInt(
        this.configService.get('RATE_LIMIT_DEFAULT_MAX', '100'),
        10,
      ),
    };

    // Auth endpoints: stricter limit (20 requests per minute)
    this.authConfig = {
      windowMs: 60 * 1000,
      maxRequests: parseInt(
        this.configService.get('RATE_LIMIT_AUTH_MAX', '20'),
        10,
      ),
    };
  }

  /**
   * Check rate limit using sliding window algorithm
   * @param key - Unique identifier (e.g., IP address, user ID)
   * @param config - Rate limit configuration
   * @returns Rate limit result with remaining count and reset time
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig = this.defaultConfig,
  ): Promise<RateLimitResult> {
    const redis = this.redisService.getClient();
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;

    // Use Redis sorted set with timestamps as scores
    // This implements a sliding window algorithm
    const pipeline = redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // Count current entries in window
    pipeline.zcard(redisKey);

    // Add current request with timestamp as score
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);

    // Set expiry on the key
    pipeline.pexpire(redisKey, config.windowMs);

    const results = await pipeline.exec();

    // zcard result is at index 1, value is at index 1 of that tuple
    const currentCount = (results?.[1]?.[1] as number) || 0;
    const resetAt = now + config.windowMs;

    if (currentCount >= config.maxRequests) {
      // Calculate retry-after in seconds
      const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const oldestTimestamp =
        oldestEntry.length >= 2 ? parseInt(oldestEntry[1], 10) : now;
      const retryAfter = Math.ceil(
        (oldestTimestamp + config.windowMs - now) / 1000,
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetAt,
    };
  }

  /**
   * Check rate limit for general API requests by IP
   */
  async checkDefaultLimit(ip: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`ip:${ip}`, this.defaultConfig);
  }

  /**
   * Check rate limit for auth endpoints (stricter)
   */
  async checkAuthLimit(ip: string): Promise<RateLimitResult> {
    return this.checkRateLimit(`auth:${ip}`, this.authConfig);
  }

  /**
   * Get the default rate limit config
   */
  getDefaultConfig(): RateLimitConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Get the auth rate limit config
   */
  getAuthConfig(): RateLimitConfig {
    return { ...this.authConfig };
  }
}
