import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockExecute = vi.fn();

// Chain helpers
mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ limit: mockLimit, orderBy: vi.fn() });
mockLimit.mockReturnValue([]);
mockInsert.mockReturnValue({ values: mockValues });
mockValues.mockReturnValue({ returning: mockReturning });
mockReturning.mockReturnValue([]);
mockUpdate.mockReturnValue({ set: mockSet });
mockSet.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ returning: mockReturning, limit: mockLimit });

const mockTx = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  execute: mockExecute,
  delete: vi.fn(),
} as never;

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  submissions: {
    id: 'submissions.id',
    submitterId: 'submitterId',
    submissionPeriodId: 'submissionPeriodId',
    status: 'status',
    formDefinitionId: 'formDefinitionId',
  },
  files: {
    manuscriptVersionId: 'files.manuscriptVersionId',
    scanStatus: 'scanStatus',
    uploadedAt: 'uploadedAt',
  },
  submissionHistory: {},
  submissionPeriods: {
    id: 'submissionPeriods.id',
    formDefinitionId: 'sp.formDefinitionId',
  },
  formDefinitions: { id: 'formDefinitions.id', status: 'fd.status' },
  users: { id: 'users.id', email: 'email', migratedAt: 'migratedAt' },
  eq: vi.fn((_col, _val) => ({ type: 'eq' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
  sql: Object.assign(
    vi.fn((..._args: unknown[]) => ({})),
    {
      raw: vi.fn(),
    },
  ),
}));

vi.mock('./migration.service.js', () => ({
  MigrationInvalidStateError: class MigrationInvalidStateError extends Error {
    override name = 'MigrationInvalidStateError' as const;
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
  asc: vi.fn(),
  ilike: vi.fn(),
  count: vi.fn(),
}));

// Mock @colophony/types
vi.mock('@colophony/types', () => ({
  isValidStatusTransition: vi.fn(() => true),
  isEditorAllowedTransition: vi.fn(() => true),
  AuditActions: {
    SUBMISSION_CREATED: 'SUBMISSION_CREATED',
    SUBMISSION_UPDATED: 'SUBMISSION_UPDATED',
    SUBMISSION_SUBMITTED: 'SUBMISSION_SUBMITTED',
    SUBMISSION_STATUS_CHANGED: 'SUBMISSION_STATUS_CHANGED',
    SUBMISSION_DELETED: 'SUBMISSION_DELETED',
    SUBMISSION_WITHDRAWN: 'SUBMISSION_WITHDRAWN',
  },
  AuditResources: {
    SUBMISSION: 'submission',
  },
}));

// Mock form.service.js
vi.mock('./form.service.js', () => ({
  formService: {
    validateFormData: vi.fn(),
    getById: vi.fn(),
  },
  FormNotFoundError: class FormNotFoundError extends Error {
    override name = 'FormNotFoundError';
    constructor(id: string) {
      super(`Form definition "${id}" not found`);
    }
  },
  FormNotPublishedError: class FormNotPublishedError extends Error {
    override name = 'FormNotPublishedError';
    constructor() {
      super('Form must be in PUBLISHED status for this operation');
    }
  },
  InvalidFormDataError: class InvalidFormDataError extends Error {
    override name = 'InvalidFormDataError';
    readonly fieldErrors: Array<{ fieldKey: string; message: string }>;
    constructor(fieldErrors: Array<{ fieldKey: string; message: string }>) {
      super('Form data validation failed');
      this.fieldErrors = fieldErrors;
    }
  },
}));

// Mock errors.js
vi.mock('./errors.js', () => ({
  ForbiddenError: class extends Error {
    override name = 'ForbiddenError';
  },
  NotFoundError: class NotFoundError extends Error {
    override name = 'NotFoundError' as const;
    constructor(message: string) {
      super(message);
    }
  },
  assertOwnerOrEditor: vi.fn(),
  assertEditorOrAdmin: vi.fn(),
}));

import {
  submissionService,
  NotDraftError,
  FormDefinitionMismatchError,
} from './submission.service.js';
import { NotFoundError } from './errors.js';
import {
  formService,
  FormNotFoundError,
  FormNotPublishedError,
  InvalidFormDataError,
} from './form.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetChain() {
  vi.clearAllMocks();
  // Restore chain mocking
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ returning: mockReturning, limit: mockLimit });
  mockLimit.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
}

const FORM_ID = 'f1111111-1111-1111-1111-111111111111';
const PERIOD_ID = 'p1111111-1111-1111-1111-111111111111';
const ORG_ID = 'org-1';
const USER_ID = 'user-1';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submissionService.create()', () => {
  beforeEach(resetChain);

  it('persists formDefinitionId and formData', async () => {
    // Period lookup — no period provided
    // Form lookup — form exists and is PUBLISHED
    mockLimit.mockResolvedValueOnce([{ id: FORM_ID, status: 'PUBLISHED' }]);
    // INSERT returning
    const createdSub = {
      id: 'sub-1',
      organizationId: ORG_ID,
      submitterId: USER_ID,
      formDefinitionId: FORM_ID,
      formData: { bio: 'Hello' },
      status: 'DRAFT',
    };
    mockReturning.mockResolvedValueOnce([createdSub]);

    const result = await submissionService.create(
      mockTx,
      {
        title: 'Test',
        formDefinitionId: FORM_ID,
        formData: { bio: 'Hello' },
      },
      ORG_ID,
      USER_ID,
    );

    expect(result).toEqual(createdSub);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('inherits formDefinitionId from submission period', async () => {
    // Period lookup
    mockLimit.mockResolvedValueOnce([
      { id: PERIOD_ID, formDefinitionId: FORM_ID },
    ]);
    // Form validation lookup
    mockLimit.mockResolvedValueOnce([{ id: FORM_ID, status: 'PUBLISHED' }]);
    // INSERT returning
    const createdSub = {
      id: 'sub-1',
      formDefinitionId: FORM_ID,
      status: 'DRAFT',
    };
    mockReturning.mockResolvedValueOnce([createdSub]);

    const result = await submissionService.create(
      mockTx,
      { title: 'Test', submissionPeriodId: PERIOD_ID },
      ORG_ID,
      USER_ID,
    );

    expect(result.formDefinitionId).toBe(FORM_ID);
  });

  it('rejects mismatched formDefinitionId when period has one', async () => {
    const otherFormId = 'f2222222-2222-2222-2222-222222222222';
    // Period lookup — period has FORM_ID
    mockLimit.mockResolvedValueOnce([
      { id: PERIOD_ID, formDefinitionId: FORM_ID },
    ]);

    await expect(
      submissionService.create(
        mockTx,
        {
          title: 'Test',
          submissionPeriodId: PERIOD_ID,
          formDefinitionId: otherFormId,
        },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow(FormDefinitionMismatchError);
  });

  it('throws NotFoundError for nonexistent/cross-tenant period', async () => {
    // Period lookup returns empty (RLS filtered it out)
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      submissionService.create(
        mockTx,
        { title: 'Test', submissionPeriodId: PERIOD_ID },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws FormNotFoundError for nonexistent form', async () => {
    // Form lookup returns empty
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      submissionService.create(
        mockTx,
        { title: 'Test', formDefinitionId: FORM_ID },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('throws FormNotPublishedError for DRAFT form', async () => {
    // Form lookup — form exists but is DRAFT
    mockLimit.mockResolvedValueOnce([{ id: FORM_ID, status: 'DRAFT' }]);

    await expect(
      submissionService.create(
        mockTx,
        { title: 'Test', formDefinitionId: FORM_ID },
        ORG_ID,
        USER_ID,
      ),
    ).rejects.toThrow(FormNotPublishedError);
  });
});

describe('submissionService.update()', () => {
  beforeEach(resetChain);

  it('updates formData', async () => {
    // FOR UPDATE select
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 'sub-1', status: 'DRAFT' }],
    });
    // update().set().where().returning()
    const updated = {
      id: 'sub-1',
      formData: { bio: 'Updated' },
      status: 'DRAFT',
    };
    mockReturning.mockResolvedValueOnce([updated]);

    const result = await submissionService.update(mockTx, 'sub-1', {
      formData: { bio: 'Updated' },
    });

    expect(result).toEqual(updated);
  });

  it('rejects update when not DRAFT', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 'sub-1', status: 'SUBMITTED' }],
    });

    await expect(
      submissionService.update(mockTx, 'sub-1', {
        formData: { bio: 'Updated' },
      }),
    ).rejects.toThrow(NotDraftError);
  });
});

describe('submissionService.updateStatus() — form validation', () => {
  beforeEach(resetChain);

  it('validates form data on DRAFT→SUBMITTED and throws on errors', async () => {
    // FOR UPDATE select — has form_definition_id
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: 'sub-1',
          status: 'DRAFT',
          form_definition_id: FORM_ID,
          form_data: { bio: '' },
          manuscript_version_id: null,
        },
      ],
    });

    // formService.validateFormData returns errors
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.validateFormData).mockResolvedValueOnce([
      { fieldKey: 'bio', message: 'Bio is required' },
    ]);

    await expect(
      submissionService.updateStatus(
        mockTx,
        'sub-1',
        'SUBMITTED',
        USER_ID,
        undefined,
        'submitter',
      ),
    ).rejects.toThrow(InvalidFormDataError);
  });

  it('succeeds with valid form data', async () => {
    // FOR UPDATE select
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: 'sub-1',
          status: 'DRAFT',
          form_definition_id: FORM_ID,
          form_data: { bio: 'Valid bio text' },
          manuscript_version_id: null,
        },
      ],
    });

    // formService.validateFormData returns no errors
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.validateFormData).mockResolvedValueOnce([]);

    // update().set().where().returning()
    const updatedSub = {
      id: 'sub-1',
      status: 'SUBMITTED',
      formDefinitionId: FORM_ID,
    };
    mockReturning.mockResolvedValueOnce([updatedSub]);

    // history insert
    const historyEntry = {
      id: 'h-1',
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
    };
    mockReturning.mockResolvedValueOnce([historyEntry]);

    const result = await submissionService.updateStatus(
      mockTx,
      'sub-1',
      'SUBMITTED',
      USER_ID,
      undefined,
      'submitter',
    );

    expect(result.submission.status).toBe('SUBMITTED');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.validateFormData).toHaveBeenCalledWith(mockTx, FORM_ID, {
      bio: 'Valid bio text',
    });
  });

  it('skips form validation when no formDefinitionId', async () => {
    // FOR UPDATE select — no form_definition_id
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: 'sub-1',
          status: 'DRAFT',
          form_definition_id: null,
          form_data: null,
          manuscript_version_id: null,
        },
      ],
    });

    // update + history
    mockReturning.mockResolvedValueOnce([{ id: 'sub-1', status: 'SUBMITTED' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'h-1' }]);

    await submissionService.updateStatus(
      mockTx,
      'sub-1',
      'SUBMITTED',
      USER_ID,
      undefined,
      'submitter',
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.validateFormData).not.toHaveBeenCalled();
  });
});
