import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Capture worker callback and event handlers
let workerCallback: (job: unknown) => Promise<void>;
let failedCallback: (job: unknown, err: Error) => Promise<void>;
const mockClose = vi.fn();

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function (_name, cb, _opts) {
    workerCallback = cb;
    return {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'failed')
          failedCallback = handler as typeof failedCallback;
      }),
      close: mockClose,
    };
  }),
}));

const mockUpdateDeliveryStatus = vi.fn();
const mockCountRecentFailures = vi.fn();
const mockUpdateEndpoint = vi.fn();
vi.mock('../../services/webhook.service.js', () => ({
  webhookService: {
    updateDeliveryStatus: (...args: unknown[]) =>
      mockUpdateDeliveryStatus(...args),
    countRecentFailures: (...args: unknown[]) =>
      mockCountRecentFailures(...args),
    updateEndpoint: (...args: unknown[]) => mockUpdateEndpoint(...args),
  },
}));

const mockAuditLog = vi.fn();
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

const mockWithRls = vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
  fn('mock-tx'),
);
vi.mock('@colophony/db', () => ({
  withRls: (...args: [unknown, (tx: unknown) => unknown]) =>
    mockWithRls(...args),
  webhookDeliveries: {
    id: 'id',
    webhookEndpointId: 'webhook_endpoint_id',
  },
  eq: vi.fn(),
}));

vi.mock('@colophony/types', () => ({
  AuditActions: {
    WEBHOOK_DELIVERED: 'WEBHOOK_DELIVERED',
    WEBHOOK_DELIVERY_FAILED: 'WEBHOOK_DELIVERY_FAILED',
    WEBHOOK_ENDPOINT_AUTO_DISABLED: 'WEBHOOK_ENDPOINT_AUTO_DISABLED',
  },
  AuditResources: {
    WEBHOOK_DELIVERY: 'webhook_delivery',
    WEBHOOK_ENDPOINT: 'webhook_endpoint',
  },
}));

vi.mock('../../config/logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockGetWebhookBackoffDelay = vi.fn().mockReturnValue(1000);
vi.mock('../../queues/webhook.queue.js', () => ({
  getWebhookBackoffDelay: (...args: unknown[]) =>
    mockGetWebhookBackoffDelay(...args),
}));

import { startWebhookWorker, stopWebhookWorker } from '../webhook.worker.js';
import type { Env } from '../../config/env.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
} as Env;

const makeJob = (overrides = {}) => ({
  data: {
    deliveryId: 'del-123',
    orgId: 'org-1',
    endpointUrl: 'https://example.com/webhook',
    secret: 'test-secret-hex',
    payload: {
      id: 'del-123',
      event: 'hopper/submission.submitted',
      timestamp: '2026-01-01T00:00:00.000Z',
      organizationId: 'org-1',
      data: { submissionId: 'sub-1' },
    },
  },
  attemptsMade: 0,
  opts: { attempts: 8 },
  id: 'del-123',
  ...overrides,
});

describe('webhook worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRls.mockImplementation(
      (_ctx: unknown, fn: (tx: unknown) => unknown) => fn('mock-tx'),
    );
    startWebhookWorker(testEnv);
  });

  it('computes correct HMAC-SHA256 signature and delivers successfully', async () => {
    const job = makeJob();
    const body = JSON.stringify(job.data.payload);
    const expectedSig =
      'sha256=' +
      crypto.createHmac('sha256', 'test-secret-hex').update(body).digest('hex');

    // Mock successful HTTP response
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await workerCallback(job);

    // Verify HMAC signature header
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Webhook-Signature': expectedSig,
          'X-Webhook-Id': 'del-123',
          'Content-Type': 'application/json',
          'User-Agent': 'Colophony-Webhook/1.0',
        }),
        body,
      }),
    );

    // Verify delivery marked as DELIVERED
    expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
      'mock-tx',
      'del-123',
      'DELIVERED',
      expect.objectContaining({
        httpStatusCode: 200,
        deliveredAt: expect.any(Date),
      }),
    );

    // Verify audit log
    expect(mockAuditLog).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('throws on non-2xx response for BullMQ retry', async () => {
    const job = makeJob();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    );

    await expect(workerCallback(job)).rejects.toThrow(
      'Webhook delivery failed: HTTP 500',
    );

    // Should store error details
    expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
      'mock-tx',
      'del-123',
      'DELIVERING',
      expect.objectContaining({
        httpStatusCode: 500,
        errorMessage: 'HTTP 500',
      }),
    );

    vi.unstubAllGlobals();
  });

  it('throws on network error for BullMQ retry', async () => {
    const job = makeJob();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')),
    );

    await expect(workerCallback(job)).rejects.toThrow('ECONNREFUSED');

    vi.unstubAllGlobals();
  });

  it('marks delivery as FAILED on final failure', async () => {
    const job = makeJob({ attemptsMade: 8 });
    const err = new Error('HTTP 500');

    // Mock the delivery lookup for auto-disable check
    mockWithRls.mockImplementation(
      (_ctx: unknown, fn: (tx: unknown) => unknown) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([{ webhookEndpointId: 'ep-1' }]),
              }),
            }),
          }),
        };
        return fn(mockTx);
      },
    );

    mockCountRecentFailures.mockResolvedValueOnce(3); // Not yet at threshold

    await failedCallback(job, err);

    expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
      expect.anything(),
      'del-123',
      'FAILED',
      { errorMessage: 'HTTP 500' },
    );
  });

  it('auto-disables endpoint with orgId filter when failure threshold met', async () => {
    const job = makeJob({ attemptsMade: 8 });
    const err = new Error('HTTP 500');

    mockWithRls.mockImplementation(
      (_ctx: unknown, fn: (tx: unknown) => unknown) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([{ webhookEndpointId: 'ep-1' }]),
              }),
            }),
          }),
        };
        return fn(mockTx);
      },
    );

    mockCountRecentFailures.mockResolvedValueOnce(5); // At threshold

    await failedCallback(job, err);

    // updateEndpoint should be called with orgId as 3rd arg
    expect(mockUpdateEndpoint).toHaveBeenCalledWith(
      expect.anything(),
      'ep-1',
      'org-1',
      { status: 'DISABLED' },
    );
  });

  it('stops worker cleanly', async () => {
    await stopWebhookWorker();
    expect(mockClose).toHaveBeenCalled();
  });
});
