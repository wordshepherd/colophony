import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock the form service before importing the router
vi.mock('../../services/form.service.js', () => ({
  formService: {
    list: vi.fn(),
    getById: vi.fn(),
    createWithAudit: vi.fn(),
    updateWithAudit: vi.fn(),
    publishWithAudit: vi.fn(),
    archiveWithAudit: vi.fn(),
    duplicateWithAudit: vi.fn(),
    deleteWithAudit: vi.fn(),
    addFieldWithAudit: vi.fn(),
    updateFieldWithAudit: vi.fn(),
    removeFieldWithAudit: vi.fn(),
    reorderFieldsWithAudit: vi.fn(),
    getFieldsByFormIds: vi.fn(),
  },
  FormNotFoundError: class FormNotFoundError extends Error {
    name = 'FormNotFoundError';
    constructor(id = 'unknown') {
      super(`Form "${id}" not found`);
    }
  },
  FormNotDraftError: class FormNotDraftError extends Error {
    name = 'FormNotDraftError';
    constructor() {
      super('Form must be in DRAFT status');
    }
  },
  FormNotPublishedError: class FormNotPublishedError extends Error {
    name = 'FormNotPublishedError';
    constructor() {
      super('Form must be in PUBLISHED status');
    }
  },
  FormHasNoFieldsError: class FormHasNoFieldsError extends Error {
    name = 'FormHasNoFieldsError';
    constructor() {
      super('Form must have at least one field');
    }
  },
  FormInUseError: class FormInUseError extends Error {
    name = 'FormInUseError';
    constructor() {
      super('Form is referenced by periods or submissions');
    }
  },
  DuplicateFieldKeyError: class DuplicateFieldKeyError extends Error {
    name = 'DuplicateFieldKeyError';
    constructor() {
      super('Duplicate field key');
    }
  },
  FormFieldNotFoundError: class FormFieldNotFoundError extends Error {
    name = 'FormFieldNotFoundError';
    constructor() {
      super('Field not found');
    }
  },
  InvalidFormDataError: class InvalidFormDataError extends Error {
    name = 'InvalidFormDataError';
    fieldErrors: { fieldKey: string; message: string }[] = [];
    constructor() {
      super('Invalid form data');
    }
  },
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  organizations: {},
  organizationMembers: {},
  users: {},
  submissions: {},
  submissionFiles: {},
  submissionHistory: {},
  formDefinitions: {},
  formFields: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { formService } from '../../services/form.service.js';
import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const mockService = vi.mocked(formService);

// ---------------------------------------------------------------------------
// UUID constants
// ---------------------------------------------------------------------------
const FORM_ID = 'a1111111-1111-4111-a111-111111111111';
const FIELD_ID = 'b2222222-2222-4222-b222-222222222222';
const ORG_ID = 'c3333333-3333-4333-a333-333333333333';
const USER_ID = 'd4444444-4444-4444-a444-444444444444';
const ZITADEL_USER_ID = 'e5555555-5555-4555-a555-555555555555';

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'EDITOR',
  overrides: Partial<TRPCContext> = {},
): TRPCContext {
  const mockTx = {} as never;
  return makeContext({
    authContext: {
      userId: USER_ID,
      zitadelUserId: ZITADEL_USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      role,
    },
    dbTx: mockTx,
    audit: vi.fn(),
    ...overrides,
  });
}

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

function makeFormDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: FORM_ID,
    organizationId: ORG_ID,
    name: 'Test Form',
    description: null,
    status: 'DRAFT' as const,
    version: 1,
    duplicatedFromId: null,
    createdBy: USER_ID,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFormField(overrides: Record<string, unknown> = {}) {
  return {
    id: FIELD_ID,
    formDefinitionId: FORM_ID,
    fieldKey: 'test_field',
    fieldType: 'text' as const,
    label: 'Test Field',
    description: null,
    placeholder: null,
    required: false,
    sortOrder: 0,
    config: null,
    conditionalRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('forms tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth / access control
  // -------------------------------------------------------------------------

  describe('auth and access', () => {
    it('list requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(caller.forms.list({ page: 1, limit: 20 })).rejects.toThrow(
        TRPCError,
      );
    });

    it('create requires org context', async () => {
      const caller = createCaller(makeContext());
      await expect(caller.forms.create({ name: 'Test' })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('returns paginated form definitions', async () => {
      const response = {
        items: [makeFormDefinition()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.list.mockResolvedValueOnce(response as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.list({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getById', () => {
    it('returns form with fields', async () => {
      const form = {
        ...makeFormDefinition(),
        fields: [makeFormField()],
      };
      mockService.getById.mockResolvedValueOnce(form as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.getById({ id: FORM_ID });
      expect(result.id).toBe(FORM_ID);
      expect(result.fields).toHaveLength(1);
    });

    it('maps FormNotFoundError to NOT_FOUND', async () => {
      mockService.getById.mockResolvedValueOnce(null as never);

      const caller = createCaller(orgContext());
      await expect(caller.forms.getById({ id: FORM_ID })).rejects.toThrow(
        'not found',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a form definition', async () => {
      const form = makeFormDefinition();
      mockService.createWithAudit.mockResolvedValueOnce(form as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.create({ name: 'Test Form' });
      expect(result.id).toBe(FORM_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.createWithAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          tx: expect.anything(),
          actor: expect.objectContaining({ userId: USER_ID, orgId: ORG_ID }),
        }),
        { name: 'Test Form' },
      );
    });
  });

  describe('update', () => {
    it('updates a DRAFT form', async () => {
      const updated = makeFormDefinition({ name: 'Updated' });
      mockService.updateWithAudit.mockResolvedValueOnce(updated as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.update({
        id: FORM_ID,
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('maps FormNotDraftError', async () => {
      const { FormNotDraftError } =
        await import('../../services/form.service.js');
      mockService.updateWithAudit.mockRejectedValueOnce(
        new FormNotDraftError(),
      );

      const caller = createCaller(orgContext());
      await expect(
        caller.forms.update({ id: FORM_ID, name: 'X' }),
      ).rejects.toThrow('DRAFT');
    });
  });

  describe('publish', () => {
    it('publishes a form', async () => {
      const published = makeFormDefinition({
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      mockService.publishWithAudit.mockResolvedValueOnce(published as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.publish({ id: FORM_ID });
      expect(result.status).toBe('PUBLISHED');
    });

    it('maps FormHasNoFieldsError', async () => {
      const { FormHasNoFieldsError } =
        await import('../../services/form.service.js');
      mockService.publishWithAudit.mockRejectedValueOnce(
        new FormHasNoFieldsError(),
      );

      const caller = createCaller(orgContext());
      await expect(caller.forms.publish({ id: FORM_ID })).rejects.toThrow(
        'at least one field',
      );
    });
  });

  describe('archive', () => {
    it('archives a published form', async () => {
      const archived = makeFormDefinition({
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });
      mockService.archiveWithAudit.mockResolvedValueOnce(archived as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.archive({ id: FORM_ID });
      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('duplicate', () => {
    it('duplicates a form with fields', async () => {
      const duplicated = {
        ...makeFormDefinition({
          id: 'f0000000-0000-4000-a000-000000000000',
          duplicatedFromId: FORM_ID,
        }),
        fields: [makeFormField()],
      };
      mockService.duplicateWithAudit.mockResolvedValueOnce(duplicated as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.duplicate({ id: FORM_ID });
      expect(result.duplicatedFromId).toBe(FORM_ID);
    });
  });

  describe('delete', () => {
    it('deletes a draft form', async () => {
      mockService.deleteWithAudit.mockResolvedValueOnce({
        success: true,
      } as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.delete({ id: FORM_ID });
      expect(result).toEqual({ success: true });
    });

    it('maps FormInUseError', async () => {
      const { FormInUseError } = await import('../../services/form.service.js');
      mockService.deleteWithAudit.mockRejectedValueOnce(new FormInUseError());

      const caller = createCaller(orgContext());
      await expect(caller.forms.delete({ id: FORM_ID })).rejects.toThrow(
        'referenced',
      );
    });
  });

  describe('addField', () => {
    it('adds a field to a draft form', async () => {
      const field = makeFormField();
      mockService.addFieldWithAudit.mockResolvedValueOnce(field as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.addField({
        id: FORM_ID,
        fieldKey: 'test_field',
        fieldType: 'text',
        label: 'Test Field',
      });
      expect(result.fieldKey).toBe('test_field');
    });

    it('maps DuplicateFieldKeyError', async () => {
      const { DuplicateFieldKeyError } =
        await import('../../services/form.service.js');
      mockService.addFieldWithAudit.mockRejectedValueOnce(
        new DuplicateFieldKeyError('test_field'),
      );

      const caller = createCaller(orgContext());
      await expect(
        caller.forms.addField({
          id: FORM_ID,
          fieldKey: 'test_field',
          fieldType: 'text',
          label: 'Test',
        }),
      ).rejects.toThrow('Duplicate');
    });
  });

  describe('removeField', () => {
    it('removes a field from a draft form', async () => {
      const field = makeFormField();
      mockService.removeFieldWithAudit.mockResolvedValueOnce(field as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.removeField({
        id: FORM_ID,
        fieldId: FIELD_ID,
      });
      expect(result.id).toBe(FIELD_ID);
    });
  });

  describe('reorderFields', () => {
    it('reorders fields in a draft form', async () => {
      const field1 = makeFormField({ sortOrder: 0 });
      const field2 = makeFormField({
        id: 'c0000000-0000-4000-a000-000000000000',
        sortOrder: 1,
      });
      mockService.reorderFieldsWithAudit.mockResolvedValueOnce([
        field1,
        field2,
      ] as never);

      const caller = createCaller(orgContext());
      const result = await caller.forms.reorderFields({
        id: FORM_ID,
        fieldIds: [FIELD_ID, 'c0000000-0000-4000-a000-000000000000'],
      });
      expect(result).toHaveLength(2);
    });
  });
});
