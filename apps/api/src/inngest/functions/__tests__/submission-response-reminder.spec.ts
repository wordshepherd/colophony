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
          // listAgingByOrg
          mocks.listAgingByOrg.mockResolvedValue(agingItems);
          return fn({});
        }
        // editors query
        return editors;
      },
    );

    const result = await handler({ step: makeStep() });
    expect(result).toEqual({ processed: 1, totalEmails: 2 });
    expect(mocks.queueEmail).toHaveBeenCalledTimes(2);
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
        mocks.listAgingByOrg.mockResolvedValue([]);
        return fn({});
      },
    );

    const result = await handler({ step: makeStep() });
    expect(result).toEqual({ processed: 1, totalEmails: 0 });
    expect(mocks.queueEmail).not.toHaveBeenCalled();
  });
});
