import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock dependencies ---

// Use a container object so vi.mock factory (hoisted) can reference it
const mocks = {
  withRls: vi.fn(),
  dbFromResult: [] as Array<Record<string, unknown>>,
  queueEmail: vi.fn(),
  listAgingByOrg: vi.fn(),
  emailProvider: 'smtp' as string,
};

vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mocks.withRls(...args),
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation(() => mocks.dbFromResult),
    }),
  },
  organizations: { id: 'id', name: 'name', settings: 'settings' },
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

vi.mock('@colophony/types', () => ({
  orgSettingsSchema: {
    safeParse: vi.fn((settings: Record<string, unknown>) => ({
      success: true,
      data: {
        responseReminderEnabled: settings?.responseReminderEnabled ?? false,
        responseReminderDays: settings?.responseReminderDays ?? 30,
      },
    })),
  },
}));

vi.mock('../../helpers/queue-email-for-recipient.js', () => ({
  queueEmailForRecipient: (...args: unknown[]) => mocks.queueEmail(...args),
}));

vi.mock('../../../services/submission.service.js', () => ({
  submissionService: {
    listAgingByOrg: (...args: unknown[]) => mocks.listAgingByOrg(...args),
  },
}));

vi.mock('../../../config/env.js', () => ({
  validateEnv: vi.fn(() => ({
    EMAIL_PROVIDER: mocks.emailProvider,
  })),
}));

vi.mock('../../client.js', () => ({
  inngest: {
    createFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: unknown) => handler,
    ),
  },
}));

// Import after mocks
import { submissionResponseReminderCron } from '../submission-response-reminder.js';

// The handler is the raw function (due to mock)
const handler = submissionResponseReminderCron as unknown as (ctx: {
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}) => Promise<unknown>;

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emailProvider = 'smtp';
  mocks.dbFromResult = [];
});

describe('submissionResponseReminderCron', () => {
  it('skips when email provider is none', async () => {
    mocks.emailProvider = 'none';
    const result = await handler({ step: makeStep() });
    expect(result).toEqual({ skipped: true, reason: 'email provider is none' });
    expect(mocks.queueEmail).not.toHaveBeenCalled();
  });

  it('skips org when reminders disabled', async () => {
    mocks.dbFromResult = [
      {
        id: 'org-1',
        name: 'Test Org',
        settings: { responseReminderEnabled: false },
      },
    ];

    const result = await handler({ step: makeStep() });
    expect(result).toEqual({
      skipped: true,
      reason: 'no orgs with reminders enabled',
    });
    expect(mocks.listAgingByOrg).not.toHaveBeenCalled();
  });

  it('processes org with correct threshold and sends emails', async () => {
    const agingItems = [
      {
        id: 's-1',
        title: 'Poem A',
        submittedAt: new Date(),
        submitterEmail: 'a@test.com',
        daysPending: 35,
      },
      {
        id: 's-2',
        title: 'Poem B',
        submittedAt: new Date(),
        submitterEmail: 'b@test.com',
        daysPending: 20,
      },
    ];

    const editors = [
      { userId: 'u-1', email: 'ed1@test.com' },
      { userId: 'u-2', email: 'ed2@test.com' },
    ];

    // Step 1: find orgs
    mocks.dbFromResult = [
      {
        id: 'org-1',
        name: 'Test Org',
        settings: {
          responseReminderEnabled: true,
          responseReminderDays: 14,
        },
      },
    ];

    // withRls calls — order: listAgingByOrg, then editors query
    let withRlsCallCount = 0;
    mocks.withRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        withRlsCallCount++;
        if (withRlsCallCount === 1) {
          // listAgingByOrg — now returns { submissions, totalCount }
          mocks.listAgingByOrg.mockResolvedValue({
            submissions: agingItems,
            totalCount: 2,
          });
          return fn({});
        }
        // editors query
        return editors;
      },
    );

    const result = await handler({ step: makeStep() });
    expect(result).toEqual({ processed: 1, totalEmails: 2 });
    expect(mocks.queueEmail).toHaveBeenCalledTimes(2);

    // Verify email template data uses new shape
    const emailCall = mocks.queueEmail.mock.calls[0][0];
    expect(emailCall.templateData.totalAging).toBe(2);
    expect(emailCall.templateData.topSubmissions).toHaveLength(2);
    expect(emailCall.templateData.hasMore).toBe(false);
    expect(emailCall.templateData.oldestDays).toBe(35);
  });

  it('sends summarized email with top 10 and totalAging count', async () => {
    // Create 12 aging items
    const agingItems = Array.from({ length: 12 }, (_, i) => ({
      id: `s-${i}`,
      title: `Poem ${i}`,
      submittedAt: new Date(),
      submitterEmail: `poet${i}@test.com`,
      daysPending: 50 - i,
    }));

    const editors = [{ userId: 'u-1', email: 'ed@test.com' }];

    mocks.dbFromResult = [
      {
        id: 'org-1',
        name: 'Big Org',
        settings: {
          responseReminderEnabled: true,
          responseReminderDays: 14,
        },
      },
    ];

    let withRlsCallCount = 0;
    mocks.withRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        withRlsCallCount++;
        if (withRlsCallCount === 1) {
          mocks.listAgingByOrg.mockResolvedValue({
            submissions: agingItems,
            totalCount: 12,
          });
          return fn({});
        }
        return editors;
      },
    );

    await handler({ step: makeStep() });

    const emailCall = mocks.queueEmail.mock.calls[0][0];
    expect(emailCall.templateData.totalAging).toBe(12);
    expect(emailCall.templateData.topSubmissions).toHaveLength(10); // capped
    expect(emailCall.templateData.hasMore).toBe(true);
    expect(emailCall.subject).toContain('12 submissions');
    expect(emailCall.subject).toContain('oldest: 50d');
  });

  it('sets hasMore=false when fewer than 10 aging submissions', async () => {
    const agingItems = [
      {
        id: 's-1',
        title: 'Poem',
        submittedAt: new Date(),
        submitterEmail: 'a@test.com',
        daysPending: 20,
      },
    ];

    const editors = [{ userId: 'u-1', email: 'ed@test.com' }];

    mocks.dbFromResult = [
      {
        id: 'org-1',
        name: 'Small Org',
        settings: {
          responseReminderEnabled: true,
          responseReminderDays: 14,
        },
      },
    ];

    let withRlsCallCount = 0;
    mocks.withRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        withRlsCallCount++;
        if (withRlsCallCount === 1) {
          mocks.listAgingByOrg.mockResolvedValue({
            submissions: agingItems,
            totalCount: 1,
          });
          return fn({});
        }
        return editors;
      },
    );

    await handler({ step: makeStep() });

    const emailCall = mocks.queueEmail.mock.calls[0][0];
    expect(emailCall.templateData.hasMore).toBe(false);
    expect(emailCall.templateData.totalAging).toBe(1);
  });

  it('skips org with no aging submissions', async () => {
    mocks.dbFromResult = [
      {
        id: 'org-1',
        name: 'Test Org',
        settings: {
          responseReminderEnabled: true,
          responseReminderDays: 30,
        },
      },
    ];

    mocks.withRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        mocks.listAgingByOrg.mockResolvedValue({
          submissions: [],
          totalCount: 0,
        });
        return fn({});
      },
    );

    const result = await handler({ step: makeStep() });
    expect(result).toEqual({ processed: 1, totalEmails: 0 });
    expect(mocks.queueEmail).not.toHaveBeenCalled();
  });
});
