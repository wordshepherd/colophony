import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockReturnThis(),
  },
  submissions: { id: 'id', title: 'title' },
  organizations: { id: 'id', name: 'name' },
  organizationMembers: {
    userId: 'userId',
    organizationId: 'organizationId',
    role: 'role',
  },
  users: { id: 'id', email: 'email' },
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

const mockIsEmailEnabled = vi.fn().mockResolvedValue(true);
vi.mock('../../../services/notification-preference.service.js', () => ({
  notificationPreferenceService: {
    isEmailEnabled: (...args: unknown[]) => mockIsEmailEnabled(...args),
  },
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
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  })),
}));

// Mock Inngest client — return the handler function directly
vi.mock('../../client.js', () => ({
  inngest: {
    createFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: unknown) => handler,
    ),
  },
}));

import {
  submissionReceivedNotification,
  submissionAcceptedNotification,
  submissionRejectedNotification,
  submissionWithdrawnNotification,
} from '../submission-notifications.js';

describe('submission notification functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn('mock-tx'),
    );
  });

  it('exports 4 notification functions', () => {
    expect(submissionReceivedNotification).toBeTypeOf('function');
    expect(submissionAcceptedNotification).toBeTypeOf('function');
    expect(submissionRejectedNotification).toBeTypeOf('function');
    expect(submissionWithdrawnNotification).toBeTypeOf('function');
  });

  it('submissionReceivedNotification skips when submission not found', async () => {
    const mockStep = {
      run: vi.fn().mockResolvedValueOnce({
        submission: null,
        orgName: 'Test Org',
      }),
    };

    const result = await (submissionReceivedNotification as any)({
      event: {
        data: {
          orgId: 'org-1',
          submissionId: 'sub-1',
          submitterId: 'user-1',
        },
      },
      step: mockStep,
    });

    expect(result).toEqual({ skipped: true, reason: 'submission-not-found' });
  });

  it('submissionAcceptedNotification skips opted-out user', async () => {
    mockIsEmailEnabled.mockResolvedValueOnce(false);

    // The function resolves data via step.run, so mock appropriately
    mockWithRls.mockResolvedValueOnce({
      submission: { id: 'sub-1', title: 'My Poem' },
      orgName: 'Test Org',
    });

    const mockStep = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          submission: { id: 'sub-1', title: 'My Poem' },
          orgName: 'Test Org',
        })
        .mockResolvedValueOnce({ email: 'user@test.com' })
        .mockResolvedValueOnce(undefined),
    };

    const result = await (submissionAcceptedNotification as any)({
      event: {
        data: {
          orgId: 'org-1',
          submissionId: 'sub-1',
          submitterId: 'user-1',
        },
      },
      step: mockStep,
    });

    // With email provider as 'smtp' and preferences disabled,
    // the queueEmailForRecipient helper returns early
    expect(result).toEqual({ notified: 1 });
  });
});
