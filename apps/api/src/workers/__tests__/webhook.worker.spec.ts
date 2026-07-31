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
const mockDisableEndpoint = vi.fn();
const mockGetEndpointForDelivery = vi.fn();
vi.mock('../../services/webhook.service.js', () => ({
  webhookService: {
    updateDeliveryStatus: (...args: unknown[]) =>
      mockUpdateDeliveryStatus(...args),
    countRecentFailures: (...args: unknown[]) =>
      mockCountRecentFailures(...args),
    updateEndpoint: (...args: unknown[]) => mockUpdateEndpoint(...args),
    disableEndpoint: (...args: unknown[]) => mockDisableEndpoint(...args),
    getEndpointForDelivery: (...args: unknown[]) =>
      mockGetEndpointForDelivery(...args),
  },
}));

// The endpoint state the worker re-reads before each send. Tests override this to
// exercise the deleted / disabled / unsubscribed branches.
const ACTIVE_ENDPOINT = {
  endpointId: 'ep-1',
  url: 'https://example.com/webhook',
  secret: 'test-secret-hex',
  status: 'ACTIVE' as const,
  eventTypes: ['hopper/submission.submitted'],
};

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
    mockGetEndpointForDelivery.mockResolvedValue(ACTIVE_ENDPOINT);
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
      'org-1',
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
      'org-1',
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
      'org-1',
      { errorMessage: 'HTTP 500' },
    );
  });

  it('auto-disables endpoint with orgId filter when failure threshold met', async () => {
    const job = makeJob({ attemptsMade: 8 });
    const err = new Error('HTTP 500');

    // The endpoint is resolved through the service join, not a raw select on tx.
    mockCountRecentFailures.mockResolvedValueOnce(5); // At threshold
    mockDisableEndpoint.mockResolvedValueOnce({ id: 'ep-1' });

    await failedCallback(job, err);

    // The failure count is org-scoped too — otherwise another tenant's failures
    // against the same endpoint id would contribute to this org's threshold.
    expect(mockCountRecentFailures).toHaveBeenCalledWith(
      expect.anything(),
      'ep-1',
      'org-1',
    );
    // `disableEndpoint`, not `updateEndpoint`: the latter throws on zero rows,
    // which would roll back the FAILED status and audit row written above.
    expect(mockDisableEndpoint).toHaveBeenCalledWith(
      expect.anything(),
      'ep-1',
      'org-1',
    );
    expect(mockUpdateEndpoint).not.toHaveBeenCalled();
  });

  it('does not audit an auto-disable that matched no row', async () => {
    const job = makeJob({ attemptsMade: 8 });
    const err = new Error('HTTP 500');

    mockCountRecentFailures.mockResolvedValueOnce(5); // At threshold
    // The endpoint was deleted between the join and this write.
    mockDisableEndpoint.mockResolvedValueOnce(null);

    await failedCallback(job, err);

    expect(mockDisableEndpoint).toHaveBeenCalled();
    // The row was written unconditionally before, so it could claim a disable
    // that never happened.
    expect(mockAuditLog).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'WEBHOOK_ENDPOINT_AUTO_DISABLED' }),
    );
  });

  describe('pre-send re-validation', () => {
    it('cancels without sending when the endpoint is disabled', async () => {
      mockGetEndpointForDelivery.mockResolvedValue({
        ...ACTIVE_ENDPOINT,
        status: 'DISABLED',
      });
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await workerCallback(makeJob());

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        'mock-tx',
        'del-123',
        'CANCELLED',
        'org-1',
        { errorMessage: expect.stringContaining('disabled') },
      );
      // Never entered DELIVERING — the attempt was not burned
      expect(mockUpdateDeliveryStatus).not.toHaveBeenCalledWith(
        'mock-tx',
        'del-123',
        'DELIVERING',
        expect.anything(),
      );
    });

    it('discards the job without any status write when the endpoint is gone', async () => {
      mockGetEndpointForDelivery.mockResolvedValue(null);
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await workerCallback(makeJob());

      expect(mockFetch).not.toHaveBeenCalled();
      // The delivery row cascaded away with the endpoint; nothing left to mark
      expect(mockUpdateDeliveryStatus).not.toHaveBeenCalled();
    });

    it('cancels when the endpoint no longer subscribes to the event', async () => {
      mockGetEndpointForDelivery.mockResolvedValue({
        ...ACTIVE_ENDPOINT,
        eventTypes: ['hopper/submission.withdrawn'],
      });
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await workerCallback(makeJob());

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        'mock-tx',
        'del-123',
        'CANCELLED',
        'org-1',
        { errorMessage: expect.stringContaining('no longer subscribes') },
      );
    });

    it('delivers a webhook.test event even though it is never in event_types', async () => {
      mockGetEndpointForDelivery.mockResolvedValue(ACTIVE_ENDPOINT);
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const job = makeJob();
      job.data.payload.event = 'webhook.test';
      await workerCallback(job);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockUpdateDeliveryStatus).toHaveBeenCalledWith(
        'mock-tx',
        'del-123',
        'DELIVERED',
        'org-1',
        expect.anything(),
      );
    });

    it('signs with the freshly-read secret and posts to the freshly-read URL', async () => {
      // Both differ from what a stale job would have carried.
      mockGetEndpointForDelivery.mockResolvedValue({
        ...ACTIVE_ENDPOINT,
        url: 'https://rotated.example.com/hook',
        secret: 'rotated-secret',
      });
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const job = makeJob();
      const body = JSON.stringify(job.data.payload);
      const expectedSig =
        'sha256=' +
        crypto
          .createHmac('sha256', 'rotated-secret')
          .update(body)
          .digest('hex');

      await workerCallback(job);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://rotated.example.com/hook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expectedSig,
          }),
        }),
      );
    });

    it('skips auto-disable and omits the URL when the endpoint is gone on final failure', async () => {
      mockGetEndpointForDelivery.mockResolvedValue(null);

      await failedCallback(makeJob({ attemptsMade: 8 }), new Error('HTTP 500'));

      expect(mockCountRecentFailures).not.toHaveBeenCalled();
      expect(mockUpdateEndpoint).not.toHaveBeenCalled();
      expect(mockAuditLog).toHaveBeenCalledWith(
        'mock-tx',
        expect.objectContaining({
          newValue: expect.objectContaining({ endpointUrl: undefined }),
        }),
      );
    });
  });

  it('stops worker cleanly', async () => {
    await stopWebhookWorker();
    expect(mockClose).toHaveBeenCalled();
  });
});
