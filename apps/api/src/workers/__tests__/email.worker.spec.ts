import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
}));

const mockUpdateStatus = vi.fn();
const mockMarkSent = vi.fn();
const mockMarkFailed = vi.fn();
vi.mock('../../services/email.service.js', () => ({
  emailService: {
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    markSent: (...args: unknown[]) => mockMarkSent(...args),
    markFailed: (...args: unknown[]) => mockMarkFailed(...args),
  },
}));

const mockAuditLog = vi.fn();
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

const mockAdapterSend = vi.fn();
vi.mock('../../adapters/email/index.js', () => ({
  createEmailAdapter: vi.fn(() => ({
    name: 'smtp',
    send: (...args: unknown[]) => mockAdapterSend(...args),
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

const mockRenderEmailTemplate = vi.fn(() => ({
  html: '<p>Hello</p>',
  text: 'Hello',
  subject: 'Test Subject',
}));
vi.mock('../../templates/email/index.js', () => ({
  renderEmailTemplate: (...args: unknown[]) => mockRenderEmailTemplate(...args),
}));

let workerCallback: (job: unknown) => Promise<unknown>;
let failedCallback: (job: unknown, err: Error) => Promise<void>;

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function (
    _name: string,
    fn: (job: unknown) => Promise<unknown>,
  ) {
    workerCallback = fn;
    return {
      on: vi.fn(
        (event: string, cb: (job: unknown, err: Error) => Promise<void>) => {
          if (event === 'failed') failedCallback = cb;
        },
      ),
      close: vi.fn(),
    };
  }),
}));

import { startEmailWorker } from '../email.worker.js';
import type { Env } from '../../config/env.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'localhost',
  SMTP_FROM: 'test@test.com',
} as Env;

describe('email worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn('mock-tx'),
    );
  });

  it('starts worker and processes job successfully', async () => {
    startEmailWorker(testEnv);

    mockAdapterSend.mockResolvedValueOnce({
      messageId: 'msg-123',
      accepted: true,
    });

    await workerCallback({
      data: {
        emailSendId: 'es-1',
        orgId: 'org-1',
        to: 'recipient@test.com',
        from: 'noreply@test.com',
        templateName: 'submission-received',
        templateData: { submissionTitle: 'Test' },
      },
      attemptsMade: 0,
    });

    // Phase 1: mark SENDING
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      'mock-tx',
      'es-1',
      'SENDING',
      1,
    );
    // Phase 4: mark SENT + audit
    expect(mockMarkSent).toHaveBeenCalledWith('mock-tx', 'es-1', 'msg-123');
    expect(mockAuditLog).toHaveBeenCalled();
  });

  it('marks FAILED immediately on template render error', async () => {
    startEmailWorker(testEnv);

    mockRenderEmailTemplate.mockImplementationOnce(() => {
      throw new Error('Unknown template: bad-template');
    });

    await workerCallback({
      data: {
        emailSendId: 'es-3',
        orgId: 'org-1',
        to: 'recipient@test.com',
        from: 'noreply@test.com',
        templateName: 'bad-template',
        templateData: {},
      },
      attemptsMade: 0,
    });

    // Should mark FAILED without retrying
    expect(mockMarkFailed).toHaveBeenCalledWith(
      'mock-tx',
      'es-3',
      'Template render error: Unknown template: bad-template',
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      'mock-tx',
      expect.objectContaining({ action: 'EMAIL_FAILED' }),
    );
    // Should NOT have tried to send
    expect(mockAdapterSend).not.toHaveBeenCalled();
  });

  it('marks FAILED + audit on final failure', async () => {
    startEmailWorker(testEnv);

    const mockJob = {
      id: 'job-1',
      data: {
        emailSendId: 'es-2',
        orgId: 'org-1',
        to: 'recipient@test.com',
        templateName: 'submission-received',
      },
      attemptsMade: 5,
      opts: { attempts: 5 },
    };

    await failedCallback(mockJob, new Error('Connection refused'));

    expect(mockMarkFailed).toHaveBeenCalledWith(
      'mock-tx',
      'es-2',
      'Connection refused',
    );
    expect(mockAuditLog).toHaveBeenCalled();
  });
});
