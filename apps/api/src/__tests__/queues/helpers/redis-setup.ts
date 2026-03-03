import { Redis } from 'ioredis';

let redis: Redis | null = null;

/**
 * Redis database index reserved for queue integration tests.
 * The dev server uses database 0 (default). Using a separate database
 * prevents dev-server Workers from stealing test jobs.
 */
const TEST_REDIS_DB = 1;

export function getRedisConfig(): {
  host: string;
  port: number;
  password?: string;
  db: number;
} {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: TEST_REDIS_DB,
  };
}

export function getRedisClient(): Redis {
  if (!redis) {
    const config = getRedisConfig();
    redis = new Redis({
      ...config,
      maxRetriesPerRequest: null, // required for BullMQ
      lazyConnect: true,
    });
  }
  return redis;
}

export async function flushRedis(): Promise<void> {
  const client = getRedisClient();
  await client.connect().catch(() => {}); // idempotent
  await client.flushdb();
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
