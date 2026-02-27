import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

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
  },
  FormNotDraftError: class FormNotDraftError extends Error {
    name = 'FormNotDraftError';
    constructor() {
      super('Form must be in DRAFT status');
    }
  },
  FormNotPublishedError: class FormNotPublishedError extends Error {
    name = 'FormNotPublishedError';
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
  },
  FormPageNotFoundError: class FormPageNotFoundError extends Error {
    name = 'FormPageNotFoundError';
  },
  InvalidFormDataError: class InvalidFormDataError extends Error {
    name = 'InvalidFormDataError';
  },
  InvalidBranchReferenceError: class InvalidBranchReferenceError extends Error {
    name = 'InvalidBranchReferenceError';
  },
}));

vi.mock('../../services/errors.js', async (importOriginal) => {
  return importOriginal();
});

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  formDefinitions: {},
  formFields: {},
  submissions: {},
  submissionFiles: {},
  submissionHistory: {},
  users: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { formService } from '../../services/form.service.js';
import { formsRouter } from './forms.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockService = vi.mocked(formService);

// Deterministic UUIDs for tests
const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const FORM_ID = 'c0000000-0000-4000-a000-000000000001';
const FIELD_ID = 'd0000000-0000-4000-a000-000000000001';

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function baseContext(): RestContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
  };
}

function authedContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: null,
    audit: vi.fn(),
  };
}

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'EDITOR',
): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      role,
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function apiKeyContext(
  scopes: string[],
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'EDITOR',
): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as any,
      orgId: ORG_ID,
      role,
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

function makeFormDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: FORM_ID,
    organizationId: ORG_ID,
    name: 'Test Form',
    description: null,
    status: 'DRAFT',
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
    fieldType: 'text',
    label: 'Test Field',
    description: null,
    placeholder: null,
    required: false,
    sortOrder: 0,
    config: null,
    conditionalRules: null,
    branchId: null,
    pageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forms REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /forms (list)
  // -------------------------------------------------------------------------

  describe('GET /forms (list)', () => {
    it('requires authentication', async () => {
      const call = client(formsRouter.list, baseContext());
      await expect(call({})).rejects.toThrow(ORPCError);
    });

    it('requires org context', async () => {
      const call = client(formsRouter.list, authedContext());
      await expect(call({})).rejects.toThrow(ORPCError);
    });

    it('returns paginated form definitions', async () => {
      const response = {
        items: [makeFormDefinition()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.list.mockResolvedValueOnce(response as never);

      const call = client(formsRouter.list, orgContext());
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
    });

    it('enforces forms:read scope for API keys', async () => {
      const ctx = apiKeyContext(['submissions:read']);
      const call = client(formsRouter.list, ctx);
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('allows forms:read scope', async () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockService.list.mockResolvedValueOnce(response as never);

      const ctx = apiKeyContext(['forms:read']);
      const call = client(formsRouter.list, ctx);
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // POST /forms (create)
  // -------------------------------------------------------------------------

  describe('POST /forms (create)', () => {
    it('requires org context', async () => {
      const call = client(formsRouter.create, authedContext());
      await expect(call({ name: 'Test' })).rejects.toThrow(ORPCError);
    });

    it('creates a form definition', async () => {
      const form = makeFormDefinition();
      mockService.createWithAudit.mockResolvedValueOnce(form as never);

      const call = client(formsRouter.create, orgContext());
      const result = await call({ name: 'Test Form' });
      expect(result.id).toBe(FORM_ID);
    });

    it('enforces forms:write scope', async () => {
      const ctx = apiKeyContext(['forms:read']);
      const call = client(formsRouter.create, ctx);
      await expect(call({ name: 'Test' })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /forms/{id} (get)
  // -------------------------------------------------------------------------

  describe('GET /forms/{id} (get)', () => {
    it('returns form with fields', async () => {
      const form = {
        ...makeFormDefinition(),
        fields: [makeFormField()],
        pages: [],
      };
      mockService.getById.mockResolvedValueOnce(form as never);

      const call = client(formsRouter.get, orgContext());
      const result = await call({ id: FORM_ID });
      expect(result.id).toBe(FORM_ID);
    });
  });

  // -------------------------------------------------------------------------
  // POST /forms/{id}/publish
  // -------------------------------------------------------------------------

  describe('POST /forms/{id}/publish', () => {
    it('publishes a draft form', async () => {
      const published = makeFormDefinition({
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      mockService.publishWithAudit.mockResolvedValueOnce(published as never);

      const call = client(formsRouter.publish, orgContext());
      const result = await call({ id: FORM_ID });
      expect(result.status).toBe('PUBLISHED');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /forms/{id}
  // -------------------------------------------------------------------------

  describe('DELETE /forms/{id} (delete)', () => {
    it('deletes a draft form', async () => {
      mockService.deleteWithAudit.mockResolvedValueOnce({
        success: true,
      } as never);

      const call = client(formsRouter['delete'], orgContext());
      const result = await call({ id: FORM_ID });
      expect(result).toEqual({ success: true });
    });
  });

  // -------------------------------------------------------------------------
  // POST /forms/{id}/fields (addField)
  // -------------------------------------------------------------------------

  describe('POST /forms/{id}/fields (addField)', () => {
    it('adds a field to a draft form', async () => {
      const field = makeFormField();
      mockService.addFieldWithAudit.mockResolvedValueOnce(field as never);

      const call = client(formsRouter.addField, orgContext());
      const result = await call({
        id: FORM_ID,
        fieldKey: 'test_field',
        fieldType: 'text',
        label: 'Test Field',
      });
      expect(result.fieldKey).toBe('test_field');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /forms/{id}/fields/{fieldId} (removeField)
  // -------------------------------------------------------------------------

  describe('DELETE /forms/{id}/fields/{fieldId} (removeField)', () => {
    it('removes a field from a draft form', async () => {
      const field = makeFormField();
      mockService.removeFieldWithAudit.mockResolvedValueOnce(field as never);

      const call = client(formsRouter.removeField, orgContext());
      const result = await call({ id: FORM_ID, fieldId: FIELD_ID });
      expect(result.id).toBe(FIELD_ID);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /forms/{id}/fields/order (reorderFields)
  // -------------------------------------------------------------------------

  describe('PUT /forms/{id}/fields/order (reorderFields)', () => {
    it('reorders fields', async () => {
      const fields = [
        makeFormField({ sortOrder: 0 }),
        makeFormField({
          id: 'e0000000-0000-4000-a000-000000000001',
          sortOrder: 1,
        }),
      ];
      mockService.reorderFieldsWithAudit.mockResolvedValueOnce(fields as never);

      const call = client(formsRouter.reorderFields, orgContext());
      const result = await call({
        id: FORM_ID,
        fieldIds: [FIELD_ID, 'e0000000-0000-4000-a000-000000000001'],
      });
      expect(result).toHaveLength(2);
    });
  });
});
