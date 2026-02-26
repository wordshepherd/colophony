import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockGetActiveEndpointsForEvent = vi.fn();
const mockCreateDelivery = vi.fn();
vi.mock('../../../services/webhook.service.js', () => ({
  webhookService: {
    getActiveEndpointsForEvent: (...args: unknown[]) =>
      mockGetActiveEndpointsForEvent(...args),
    createDelivery: (...args: unknown[]) => mockCreateDelivery(...args),
  },
}));

const mockEnqueueWebhook = vi.fn();
vi.mock('../../../queues/webhook.queue.js', () => ({
  enqueueWebhook: (...args: unknown[]) => mockEnqueueWebhook(...args),
}));

vi.mock('../../../config/env.js', () => ({
  validateEnv: () => ({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

vi.mock('@colophony/db', () => ({
  withRls: vi.fn((_ctx: unknown, fn: (tx: string) => unknown) => fn('mock-tx')),
}));

// Mock Inngest client — capture function config
let capturedFunction: {
  config: Record<string, unknown>;
  triggers: unknown[];
  handler: (args: {
    event: Record<string, unknown>;
    step: Record<string, unknown>;
  }) => Promise<unknown>;
};

vi.mock('../../client.js', () => ({
  inngest: {
    createFunction: (
      config: Record<string, unknown>,
      triggers: unknown[],
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) => {
      capturedFunction = { config, triggers, handler };
      return { config, triggers, handler };
    },
  },
}));

describe('webhookDelivery Inngest function', () => {
  beforeAll(async () => {
    // Import after mocks so vi.mock intercepts all dependencies
    await import('../webhook-delivery.js');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listens to all expected event types', () => {
    expect(capturedFunction.triggers).toHaveLength(10);
    const eventNames = capturedFunction.triggers.map(
      (t: unknown) => (t as { event: string }).event,
    );
    expect(eventNames).toContain('hopper/submission.submitted');
    expect(eventNames).toContain('hopper/submission.accepted');
    expect(eventNames).toContain('hopper/submission.rejected');
    expect(eventNames).toContain('hopper/submission.withdrawn');
    expect(eventNames).toContain('slate/pipeline.copyeditor-assigned');
    expect(eventNames).toContain('slate/pipeline.copyedit-completed');
    expect(eventNames).toContain('slate/pipeline.author-review-completed');
    expect(eventNames).toContain('slate/pipeline.proofread-completed');
    expect(eventNames).toContain('slate/contract.generated');
    expect(eventNames).toContain('slate/issue.published');
  });

  it('skips when no active endpoints found', async () => {
    mockGetActiveEndpointsForEvent.mockResolvedValueOnce([]);

    const stepRun = vi.fn((_label: string, fn: () => Promise<unknown>) => fn());
    const event = {
      name: 'hopper/submission.submitted',
      id: 'evt-1',
      data: { orgId: 'org-1', submissionId: 'sub-1' },
    };

    const result = await capturedFunction.handler({
      event,
      step: { run: stepRun },
    });
    expect(result).toEqual({ skipped: true, reason: 'no-endpoints' });
    expect(mockEnqueueWebhook).not.toHaveBeenCalled();
  });

  it('fans out to multiple endpoints', async () => {
    const endpoints = [
      { id: 'ep-1', url: 'https://a.com', secret: 'sec-a' },
      { id: 'ep-2', url: 'https://b.com', secret: 'sec-b' },
    ];
    mockGetActiveEndpointsForEvent.mockResolvedValueOnce(endpoints);
    mockCreateDelivery
      .mockResolvedValueOnce({ id: 'del-1' })
      .mockResolvedValueOnce({ id: 'del-2' });
    mockEnqueueWebhook.mockResolvedValue(undefined);

    const stepRun = vi.fn((_label: string, fn: () => Promise<unknown>) => fn());
    const event = {
      name: 'hopper/submission.submitted',
      id: 'evt-1',
      data: { orgId: 'org-1', submissionId: 'sub-1' },
    };

    const result = await capturedFunction.handler({
      event,
      step: { run: stepRun },
    });

    expect(result).toEqual({ delivered: 2 });
    expect(mockCreateDelivery).toHaveBeenCalledTimes(2);
    expect(mockEnqueueWebhook).toHaveBeenCalledTimes(2);
  });
});
