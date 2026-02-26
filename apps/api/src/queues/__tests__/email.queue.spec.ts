import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockClose = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function () {
    return { add: mockAdd, close: mockClose };
  }),
}));

import { enqueueEmail, closeEmailQueue } from '../email.queue.js';
import type { Env } from '../../config/env.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
} as Env;

describe('email queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues an email job with emailSendId as jobId for idempotency', async () => {
    mockAdd.mockResolvedValueOnce({});

    await enqueueEmail(testEnv, {
      emailSendId: 'es-123',
      orgId: 'org-1',
      to: 'test@test.com',
      from: 'noreply@example.com',
      templateName: 'submission-received',
      templateData: { submissionTitle: 'Test' },
    });

    expect(mockAdd).toHaveBeenCalledWith(
      'send',
      {
        emailSendId: 'es-123',
        orgId: 'org-1',
        to: 'test@test.com',
        from: 'noreply@example.com',
        templateName: 'submission-received',
        templateData: { submissionTitle: 'Test' },
      },
      { jobId: 'es-123' },
    );
  });

  it('closes queue on shutdown', async () => {
    mockClose.mockResolvedValueOnce(undefined);
    await enqueueEmail(testEnv, {
      emailSendId: 'es-456',
      orgId: 'org-2',
      to: 'test@test.com',
      from: 'noreply@example.com',
      templateName: 'submission-accepted',
      templateData: {},
    });

    await closeEmailQueue();
    expect(mockClose).toHaveBeenCalled();
  });

  it('closeEmailQueue is safe to call when no queue exists', async () => {
    await expect(closeEmailQueue()).resolves.toBeUndefined();
  });
});
