import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Build a chainable mock for select().from().leftJoin().where().orderBy().limit()
let mockRows: Array<Record<string, unknown>> = [];
let mockCountRows: Array<Record<string, unknown>> = [{ value: 0 }];

const mockLimit = vi.fn().mockImplementation(() => mockRows);
const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

// Count query chain: select().from().where() → [{ value: N }]
const mockCountWhere = vi.fn().mockImplementation(() => mockCountRows);
const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

const mockSelect = vi.fn().mockImplementation((arg: unknown) => {
  // Detect count query by checking the argument shape
  if (arg && typeof arg === 'object' && 'value' in arg) {
    return { from: mockCountFrom };
  }
  return { from: mockFrom };
});

vi.mock('@colophony/db', () => ({
  db: {},
  submissions: {
    id: 'id',
    title: 'title',
    submittedAt: 'submitted_at',
    submitterId: 'submitter_id',
    status: 'status',
  },
  users: { id: 'id', email: 'email' },
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
  type: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const mod = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...mod,
    lte: vi.fn(),
    notInArray: vi.fn(),
    isNotNull: vi.fn(),
    count: vi.fn().mockReturnValue({ as: vi.fn() }),
  };
});

// Mock other service imports that submission.service.ts imports
vi.mock('../outbox.js', () => ({
  enqueueOutboxEvent: vi.fn(),
}));
vi.mock('../errors.js', () => ({
  ForbiddenError: class extends Error {},
  NotFoundError: class extends Error {},
  assertOwnerOrEditor: vi.fn(),
  assertEditorOrAdmin: vi.fn(),
}));
vi.mock('../blind-review.helper.js', () => ({
  resolveBlindMode: vi.fn(),
  applySubmitterBlinding: vi.fn(),
}));
vi.mock('../form.service.js', () => ({
  formService: {},
  FormNotFoundError: class extends Error {},
  FormNotPublishedError: class extends Error {},
  InvalidFormDataError: class extends Error {},
}));
vi.mock('../migration.service.js', () => ({
  MigrationInvalidStateError: class extends Error {},
}));
vi.mock('../submission-reviewer.service.js', () => ({
  submissionReviewerService: {},
  ReviewerAlreadyAssignedError: class extends Error {},
}));

import { submissionService } from '../submission.service.js';

// Pin time to noon on 2026-03-15 to avoid midnight boundary flakiness
const FIXED_NOW = new Date('2026-03-15T12:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  mockRows = [];
  mockCountRows = [{ value: 0 }];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('submissionService.listAgingByOrg', () => {
  const fakeTx = {
    select: mockSelect,
  } as unknown as Parameters<typeof submissionService.listAgingByOrg>[0];

  it('returns submissions older than threshold', async () => {
    // 35 days before fixed now
    const thirtyFiveDaysAgo = new Date('2026-02-08T12:00:00.000Z');

    mockCountRows = [{ value: 1 }];
    mockRows = [
      {
        id: 's-1',
        title: 'Old Poem',
        submittedAt: thirtyFiveDaysAgo,
        submitterEmail: 'poet@test.com',
      },
    ];

    const result = await submissionService.listAgingByOrg(fakeTx, 30);
    expect(result.submissions).toHaveLength(1);
    expect(result.submissions[0].daysPending).toBe(35);
    expect(result.submissions[0].title).toBe('Old Poem');
  });

  it('returns empty for no matching rows', async () => {
    mockRows = [];
    mockCountRows = [{ value: 0 }];
    const result = await submissionService.listAgingByOrg(fakeTx, 30);
    expect(result.submissions).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('computes daysPending correctly', async () => {
    // 10 days before fixed now
    const tenDaysAgo = new Date('2026-03-05T12:00:00.000Z');

    mockCountRows = [{ value: 1 }];
    mockRows = [
      {
        id: 's-2',
        title: 'Recent',
        submittedAt: tenDaysAgo,
        submitterEmail: 'x@test.com',
      },
    ];

    const result = await submissionService.listAgingByOrg(fakeTx, 5);
    expect(result.submissions[0].daysPending).toBe(10);
  });

  it('returns totalCount alongside submissions', async () => {
    mockCountRows = [{ value: 42 }];
    mockRows = [
      {
        id: 's-1',
        title: 'Test',
        submittedAt: new Date(),
        submitterEmail: 'a@test.com',
      },
    ];

    const result = await submissionService.listAgingByOrg(fakeTx, 7);
    expect(result.totalCount).toBe(42);
    expect(result.submissions).toHaveLength(1);
  });
});
