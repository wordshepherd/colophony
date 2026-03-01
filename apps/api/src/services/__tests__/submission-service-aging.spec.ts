import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a chainable mock for select().from().leftJoin().where().orderBy()
let mockRows: Array<Record<string, unknown>> = [];

const mockOrderBy = vi.fn().mockImplementation(() => mockRows);
const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

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

beforeEach(() => {
  vi.clearAllMocks();
  mockRows = [];
});

describe('submissionService.listAgingByOrg', () => {
  const fakeTx = {
    select: mockSelect,
  } as unknown as Parameters<typeof submissionService.listAgingByOrg>[0];

  it('returns submissions older than threshold', async () => {
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

    mockRows = [
      {
        id: 's-1',
        title: 'Old Poem',
        submittedAt: thirtyFiveDaysAgo,
        submitterEmail: 'poet@test.com',
      },
    ];

    const results = await submissionService.listAgingByOrg(fakeTx, 30);
    expect(results).toHaveLength(1);
    expect(results[0].daysPending).toBeGreaterThanOrEqual(35);
    expect(results[0].title).toBe('Old Poem');
  });

  it('returns empty for no matching rows', async () => {
    mockRows = [];
    const results = await submissionService.listAgingByOrg(fakeTx, 30);
    expect(results).toEqual([]);
  });

  it('computes daysPending correctly', async () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    mockRows = [
      {
        id: 's-2',
        title: 'Recent',
        submittedAt: tenDaysAgo,
        submitterEmail: 'x@test.com',
      },
    ];

    const results = await submissionService.listAgingByOrg(fakeTx, 5);
    expect(results[0].daysPending).toBeGreaterThanOrEqual(10);
  });
});
