import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../context.js';
import type { AuthContext } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Mocks — must mock all services imported by any resolver since schema.ts
// imports all resolvers as side effects.
// ---------------------------------------------------------------------------

vi.mock('../guards.js', () => ({
  requireAuth: vi.fn(),
  requireOrgContext: vi.fn(),
  requireAdmin: vi.fn(),
  requireScopes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/context.js', () => ({
  toServiceContext: vi.fn((ctx: unknown) => ctx),
}));

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
  FormNotFoundError: class extends Error {
    name = 'FormNotFoundError';
  },
  FormFieldNotFoundError: class extends Error {
    name = 'FormFieldNotFoundError';
  },
  FormNotDraftError: class extends Error {
    name = 'FormNotDraftError';
  },
  FormNotPublishedError: class extends Error {
    name = 'FormNotPublishedError';
  },
  DuplicateFieldKeyError: class extends Error {
    name = 'DuplicateFieldKeyError';
  },
  FormHasNoFieldsError: class extends Error {
    name = 'FormHasNoFieldsError';
  },
  FormInUseError: class extends Error {
    name = 'FormInUseError';
  },
  InvalidFormDataError: class extends Error {
    name = 'InvalidFormDataError';
  },
}));

vi.mock('../../services/submission.service.js', () => ({
  submissionService: {
    listAll: vi.fn(),
    listBySubmitter: vi.fn(),
    getByIdWithAccess: vi.fn(),
    getHistoryWithAccess: vi.fn(),
    createWithAudit: vi.fn(),
    updateAsOwner: vi.fn(),
    submitAsOwner: vi.fn(),
    deleteAsOwner: vi.fn(),
    withdrawAsOwner: vi.fn(),
    updateStatusAsEditor: vi.fn(),
  },
  SubmissionNotFoundError: class extends Error {
    name = 'SubmissionNotFoundError';
  },
  NotDraftError: class extends Error {
    name = 'NotDraftError';
  },
  InvalidStatusTransitionError: class extends Error {
    name = 'InvalidStatusTransitionError';
  },
  UnscannedFilesError: class extends Error {
    name = 'UnscannedFilesError';
  },
  InfectedFilesError: class extends Error {
    name = 'InfectedFilesError';
  },
  FormDefinitionMismatchError: class extends Error {
    name = 'FormDefinitionMismatchError';
  },
}));

vi.mock('../../services/errors.js', () => ({
  assertEditorOrAdmin: vi.fn(),
  assertOwnerOrEditor: vi.fn(),
  ForbiddenError: class extends Error {
    name = 'ForbiddenError';
  },
  NotFoundError: class extends Error {
    name = 'NotFoundError';
  },
}));

vi.mock('../../services/file.service.js', () => ({
  fileService: { deleteAsOwner: vi.fn() },
  FileNotFoundError: class extends Error {
    name = 'FileNotFoundError';
  },
  FileNotCleanError: class extends Error {
    name = 'FileNotCleanError';
  },
}));

vi.mock('../../services/organization.service.js', () => ({
  organizationService: {
    listUserOrganizations: vi.fn(),
    getById: vi.fn(),
    listMembers: vi.fn(),
    createWithAudit: vi.fn(),
    updateWithAudit: vi.fn(),
    addMemberWithAudit: vi.fn(),
    removeMemberWithAudit: vi.fn(),
    updateMemberRoleWithAudit: vi.fn(),
  },
  UserNotFoundError: class extends Error {
    name = 'UserNotFoundError';
  },
  LastAdminError: class extends Error {
    name = 'LastAdminError';
  },
}));

vi.mock('../../services/api-key.service.js', () => ({
  apiKeyService: {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../error-mapper.js', () => ({
  mapServiceError: vi.fn((e: unknown) => {
    throw e;
  }),
}));

vi.mock('../../services/scope-check.js', () => ({
  checkApiKeyScopes: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('../../services/s3.js', () => ({
  createS3Client: vi.fn().mockReturnValue({}),
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: vi.fn().mockReturnValue({
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'test',
    S3_SECRET_KEY: 'test',
    S3_BUCKET: 'submissions',
    S3_QUARANTINE_BUCKET: 'quarantine',
  }),
}));

import { requireOrgContext, requireScopes } from '../guards.js';
import { formService } from '../../services/form.service.js';
import { mapServiceError } from '../error-mapper.js';

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockRequireScopes = vi.mocked(requireScopes);

import { schema } from '../schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FIELD_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

function makeCtx(): GraphQLContext {
  return {
    authContext: {
      userId: 'user-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'oidc' as const,
      orgId: 'org-1',
      role: 'EDITOR' as const,
    },
    dbTx: {} as DrizzleDb,
    audit: vi.fn().mockResolvedValue(undefined),
    loaders: {} as GraphQLContext['loaders'],
  };
}

function makeOrgCtx() {
  const ctx = makeCtx();
  return {
    ...ctx,
    authContext: ctx.authContext as AuthContext & {
      orgId: string;
      role: 'ADMIN' | 'EDITOR' | 'READER';
    },
    dbTx: ctx.dbTx as DrizzleDb,
  };
}

function getQueryField(name: string) {
  const queryType = schema.getQueryType();
  expect(queryType).toBeDefined();
  return queryType!.getFields()[name];
}

function getMutationField(name: string) {
  const mutationType = schema.getMutationType();
  expect(mutationType).toBeDefined();
  return mutationType!.getFields()[name];
}

function makeFormDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: FORM_ID,
    organizationId: 'org-1',
    name: 'Test Form',
    description: null,
    status: 'DRAFT' as const,
    version: 1,
    duplicatedFromId: null,
    createdBy: 'user-1',
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

// ---------------------------------------------------------------------------
// Tests — schema registration
// ---------------------------------------------------------------------------

describe('Form resolvers — schema', () => {
  it('registers formDefinitions query', () => {
    const field = getQueryField('formDefinitions');
    expect(field).toBeDefined();
  });

  it('registers formDefinition query', () => {
    const field = getQueryField('formDefinition');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('id');
  });

  it('registers createFormDefinition mutation', () => {
    const field = getMutationField('createFormDefinition');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('name');
  });

  it('registers publishFormDefinition mutation', () => {
    const field = getMutationField('publishFormDefinition');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('id');
  });

  it('registers deleteFormDefinition mutation', () => {
    const field = getMutationField('deleteFormDefinition');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('id');
  });

  it('registers addFormField mutation', () => {
    const field = getMutationField('addFormField');
    expect(field).toBeDefined();
    const argNames = field.args.map((a) => a.name);
    expect(argNames).toContain('formId');
    expect(argNames).toContain('fieldKey');
    expect(argNames).toContain('fieldType');
    expect(argNames).toContain('label');
  });

  it('registers reorderFormFields mutation', () => {
    const field = getMutationField('reorderFormFields');
    expect(field).toBeDefined();
    const argNames = field.args.map((a) => a.name);
    expect(argNames).toContain('formId');
    expect(argNames).toContain('fieldIds');
  });
});

// ---------------------------------------------------------------------------
// Tests — resolver wiring
// ---------------------------------------------------------------------------

describe('Form resolvers — wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockReturnValue(makeOrgCtx());
    mockRequireScopes.mockResolvedValue(undefined);
  });

  it('createFormDefinition calls requireOrgContext + service', async () => {
    const form = makeFormDefinition();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.createWithAudit).mockResolvedValue(form);

    const field = getMutationField('createFormDefinition');
    const result = await field.resolve!(
      {},
      { name: 'Test Form' },
      makeCtx(),
      {} as never,
    );

    expect(mockRequireOrgContext).toHaveBeenCalled();
    expect(mockRequireScopes).toHaveBeenCalledWith(
      expect.anything(),
      'forms:write',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.createWithAudit).toHaveBeenCalled();
    expect(result).toEqual(form);
  });

  it('createFormDefinition guard failure prevents service call', async () => {
    mockRequireOrgContext.mockImplementation(() => {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    const field = getMutationField('createFormDefinition');
    await expect(
      field.resolve!({}, { name: 'X' }, makeCtx(), {} as never),
    ).rejects.toThrow('Not authenticated');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.createWithAudit).not.toHaveBeenCalled();
  });

  it('createFormDefinition validates input via Zod', async () => {
    const field = getMutationField('createFormDefinition');
    await expect(
      field.resolve!({}, { name: '' }, makeCtx(), {} as never),
    ).rejects.toThrow(); // Zod rejects empty name
  });

  it('deleteFormDefinition calls deleteWithAudit', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.deleteWithAudit).mockResolvedValue({
      success: true,
    });

    const field = getMutationField('deleteFormDefinition');
    const result = await field.resolve!(
      {},
      { id: FORM_ID },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.deleteWithAudit).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('publishFormDefinition calls publishWithAudit', async () => {
    const published = makeFormDefinition({
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.publishWithAudit).mockResolvedValue(published);

    const field = getMutationField('publishFormDefinition');
    const result = await field.resolve!(
      {},
      { id: FORM_ID },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.publishWithAudit).toHaveBeenCalled();
    expect(result).toEqual(published);
  });

  it('addFormField calls addFieldWithAudit', async () => {
    const formField = makeFormField();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.addFieldWithAudit).mockResolvedValue(formField);

    const field = getMutationField('addFormField');
    const result = await field.resolve!(
      {},
      {
        formId: FORM_ID,
        fieldKey: 'test_field',
        fieldType: 'text',
        label: 'Test Field',
      },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.addFieldWithAudit).toHaveBeenCalled();
    expect(result).toEqual(formField);
  });

  it('formDefinition query validates id as UUID', async () => {
    const field = getQueryField('formDefinition');
    await expect(
      field.resolve!({}, { id: 'not-a-uuid' }, makeCtx(), {} as never),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.getById).not.toHaveBeenCalled();
  });

  it('addFormField validates formId as UUID', async () => {
    const field = getMutationField('addFormField');
    await expect(
      field.resolve!(
        {},
        { formId: 'not-a-uuid', fieldKey: 'k', fieldType: 'text', label: 'L' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.addFieldWithAudit).not.toHaveBeenCalled();
  });

  it('updateFormField validates formId and fieldId as UUID', async () => {
    const field = getMutationField('updateFormField');
    await expect(
      field.resolve!(
        {},
        { formId: 'not-a-uuid', fieldId: FIELD_ID, label: 'X' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    await expect(
      field.resolve!(
        {},
        { formId: FORM_ID, fieldId: 'not-a-uuid', label: 'X' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.updateFieldWithAudit).not.toHaveBeenCalled();
  });

  it('removeFormField validates formId and fieldId as UUID', async () => {
    const field = getMutationField('removeFormField');
    await expect(
      field.resolve!(
        {},
        { formId: 'not-a-uuid', fieldId: FIELD_ID },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.removeFieldWithAudit).not.toHaveBeenCalled();
  });

  it('reorderFormFields validates formId as UUID', async () => {
    const field = getMutationField('reorderFormFields');
    await expect(
      field.resolve!(
        {},
        { formId: 'not-a-uuid', fieldIds: [FIELD_ID] },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(formService.reorderFieldsWithAudit).not.toHaveBeenCalled();
  });

  it('auditEvent query validates id as UUID', async () => {
    const field = getQueryField('auditEvent');
    await expect(
      field.resolve!({}, { id: 'not-a-uuid' }, makeCtx(), {} as never),
    ).rejects.toThrow();
  });

  it('mapServiceError is called on service failure', async () => {
    const error = new Error('Service failed');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(formService.createWithAudit).mockRejectedValue(error);

    const field = getMutationField('createFormDefinition');
    await expect(
      field.resolve!({}, { name: 'Test' }, makeCtx(), {} as never),
    ).rejects.toThrow();
    expect(mapServiceError).toHaveBeenCalledWith(error);
  });
});
