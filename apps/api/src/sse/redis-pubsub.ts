import Redis from 'ioredis';
import type { Env } from '../config/env.js';

export interface NotificationEvent {
  id: string;
  eventType: string;
  title: string;
  body?: string | null;
  link?: string | null;
  createdAt: string;
}

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function createRedis(env: Env): Redis {
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}

export function getPublisher(env: Env): Redis {
  if (!publisher) {
    publisher = createRedis(env);
    void publisher.connect();
  }
  return publisher;
}

export function getSubscriber(env: Env): Redis {
  if (!subscriber) {
    subscriber = createRedis(env);
    void subscriber.connect();
  }
  return subscriber;
}

export function channelKey(orgId: string, userId: string): string {
  return `notifications:${orgId}:${userId}`;
}

export async function publishNotification(
  env: Env,
  orgId: string,
  userId: string,
  event: NotificationEvent,
): Promise<void> {
  const pub = getPublisher(env);
  await pub.publish(channelKey(orgId, userId), JSON.stringify(event));
}

// Track active per-connection subscribers for SSE shutdown
const activeConnections = new Set<Redis>();

export function trackConnection(redis: Redis): void {
  activeConnections.add(redis);
}

export function untrackConnection(redis: Redis): void {
  activeConnections.delete(redis);
}

export async function closeAllSSEConnections(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const conn of activeConnections) {
    promises.push(
      conn
        .quit()
        .then(() => undefined)
        .catch(() => undefined),
    );
  }
  await Promise.all(promises);
  activeConnections.clear();
}

export async function closePublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit().catch(() => undefined);
    publisher = null;
  }
}

export async function closeSubscriber(): Promise<void> {
  if (subscriber) {
    await subscriber.quit().catch(() => undefined);
    subscriber = null;
  }
}
