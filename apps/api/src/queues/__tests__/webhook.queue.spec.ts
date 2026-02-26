import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockClose = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function () {
    return { add: mockAdd, close: mockClose };
  }),
}));

import {
  enqueueWebhook,
  closeWebhookQueue,
  getWebhookBackoffDelay,
} from '../webhook.queue.js';
import type { Env } from '../../config/env.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
} as Env;

describe('webhook queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues a webhook job with deliveryId as jobId for idempotency', async () => {
    mockAdd.mockResolvedValueOnce({});

    const payload = {
      id: 'del-123',
      event: 'hopper/submission.submitted',
      timestamp: '2026-01-01T00:00:00.000Z',
      organizationId: 'org-1',
      data: { submissionId: 'sub-1' },
    };

    await enqueueWebhook(testEnv, {
      deliveryId: 'del-123',
      orgId: 'org-1',
      endpointUrl: 'https://example.com/webhook',
      secret: 'test-secret',
      payload,
    });

    expect(mockAdd).toHaveBeenCalledWith(
      'deliver',
      {
        deliveryId: 'del-123',
        orgId: 'org-1',
        endpointUrl: 'https://example.com/webhook',
        secret: 'test-secret',
        payload,
      },
      { jobId: 'del-123' },
    );
  });

  it('closes queue on shutdown', async () => {
    mockAdd.mockResolvedValueOnce({});
    await enqueueWebhook(testEnv, {
      deliveryId: 'del-456',
      orgId: 'org-1',
      endpointUrl: 'https://example.com',
      secret: 'secret',
      payload: {
        id: 'del-456',
        event: 'webhook.test',
        timestamp: '2026-01-01T00:00:00.000Z',
        organizationId: 'org-1',
        data: {},
      },
    });
    await closeWebhookQueue();
    expect(mockClose).toHaveBeenCalled();
  });

  it('returns correct backoff delays for each attempt', () => {
    expect(getWebhookBackoffDelay(0)).toBe(1_000);
    expect(getWebhookBackoffDelay(1)).toBe(5_000);
    expect(getWebhookBackoffDelay(2)).toBe(30_000);
    expect(getWebhookBackoffDelay(3)).toBe(120_000);
    expect(getWebhookBackoffDelay(4)).toBe(600_000);
    expect(getWebhookBackoffDelay(5)).toBe(3_600_000);
    expect(getWebhookBackoffDelay(6)).toBe(3_600_000);
    expect(getWebhookBackoffDelay(7)).toBe(3_600_000);
    // Beyond array length, clamps to last value
    expect(getWebhookBackoffDelay(100)).toBe(3_600_000);
  });
});
