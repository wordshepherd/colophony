import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
  submissions: { id: 'id', title: 'title' },
  organizations: { id: 'id', name: 'name' },
  eq: vi.fn(),
}));

const mockCreateEmail = vi.fn().mockResolvedValue({ id: 'es-1' });
vi.mock('../../../services/email.service.js', () => ({
  emailService: {
    create: (...args: unknown[]) => mockCreateEmail(...args),
  },
}));

const mockAuditLog = vi.fn();
vi.mock('../../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

vi.mock('@colophony/types', () => ({
  AuditActions: { EMAIL_QUEUED: 'EMAIL_QUEUED' },
  AuditResources: { EMAIL: 'email' },
}));

const mockEnqueueEmail = vi.fn();
vi.mock('../../../queues/email.queue.js', () => ({
  enqueueEmail: (...args: unknown[]) => mockEnqueueEmail(...args),
}));

vi.mock('../../../config/env.js', () => ({
  validateEnv: vi.fn(() => ({
    EMAIL_PROVIDER: 'smtp',
    SMTP_FROM: 'noreply@test.com',
    CORS_ORIGIN: 'http://localhost:3000',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  })),
}));

vi.mock('../../client.js', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, handler: unknown) => handler),
  },
}));

import { embedSubmissionConfirmation } from '../embed-submission-confirmation.js';

// The mock makes createFunction return the handler directly
const handler = embedSubmissionConfirmation as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}) => Promise<Record<string, unknown>>;

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

describe('embedSubmissionConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips non-embed submissions (isEmbed falsy)', async () => {
    const result = await handler({
      event: {
        data: {
          orgId: 'org-1',
          submissionId: 'sub-1',
          submitterId: 'user-1',
          // No isEmbed, submitterEmail, statusToken
        },
      },
      step: makeStep(),
    });

    expect(result).toEqual({
      skipped: true,
      reason: 'not-embed-submission',
    });
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it('skips when EMAIL_PROVIDER is none', async () => {
    const { validateEnv } = await import('../../../config/env.js');
    vi.mocked(validateEnv).mockReturnValue({
      EMAIL_PROVIDER: 'none',
    } as ReturnType<typeof validateEnv>);

    const result = await handler({
      event: {
        data: {
          orgId: 'org-1',
          submissionId: 'sub-1',
          submitterId: 'user-1',
          isEmbed: true,
          submitterEmail: 'test@example.com',
          statusToken: 'col_sta_abc123',
        },
      },
      step: makeStep(),
    });

    expect(result).toEqual({ skipped: true, reason: 'email-disabled' });
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it('queues confirmation email with correct template data for embed submission', async () => {
    const { validateEnv } = await import('../../../config/env.js');
    vi.mocked(validateEnv).mockReturnValue({
      EMAIL_PROVIDER: 'smtp',
      SMTP_FROM: 'noreply@test.com',
      CORS_ORIGIN: 'http://localhost:3000',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    } as ReturnType<typeof validateEnv>);

    // Mock withRls to resolve data
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {};
        return fn(mockTx);
      },
    );

    // First call: resolve-data (withRls for submission + org lookup)
    let resolveDataCallIndex = 0;
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        resolveDataCallIndex++;
        const mockTx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            // First limit call: submission query
            // Second limit call: org query
            if (resolveDataCallIndex === 1) {
              return Promise.resolve([{ title: 'My Great Poem' }]);
            }
            return Promise.resolve([{ name: 'Poetry Review' }]);
          }),
        };
        return fn(mockTx);
      },
    );

    const step = makeStep();
    // Override step.run to actually execute functions but also let us check calls
    step.run.mockImplementation(
      async (name: string, fn: () => Promise<unknown>) => {
        if (name === 'resolve-data') {
          return { submissionTitle: 'My Great Poem', orgName: 'Poetry Review' };
        }
        return fn();
      },
    );

    const result = await handler({
      event: {
        data: {
          orgId: 'org-1',
          submissionId: 'sub-1',
          submitterId: 'user-1',
          isEmbed: true,
          submitterEmail: 'submitter@example.com',
          statusToken: 'col_sta_abc123def456',
        },
      },
      step,
    });

    expect(result).toEqual({ sent: true, to: 'submitter@example.com' });
    expect(mockEnqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({ EMAIL_PROVIDER: 'smtp' }),
      expect.objectContaining({
        to: 'submitter@example.com',
        templateName: 'embed-submission-confirmation',
        templateData: {
          submissionTitle: 'My Great Poem',
          orgName: 'Poetry Review',
          statusCheckUrl:
            'http://localhost:3000/embed/status/col_sta_abc123def456',
        },
      }),
    );
  });
});
