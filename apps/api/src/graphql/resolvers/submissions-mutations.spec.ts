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
    resubmitAsOwner: vi.fn(),
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
  MissingRevisionNotesError: class extends Error {
    name = 'MissingRevisionNotesError';
  },
  NotReviseAndResubmitError: class extends Error {
    name = 'NotReviseAndResubmitError';
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
    validateFormData: vi.fn(),
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
    fieldErrors = [];
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
import { submissionService } from '../../services/submission.service.js';
import { mapServiceError } from '../error-mapper.js';

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockRequireScopes = vi.mocked(requireScopes);

import { schema } from '../schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getMutationField(name: string) {
  const mutationType = schema.getMutationType();
  expect(mutationType).toBeDefined();
  const fields = mutationType!.getFields();
  return fields[name];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Submission mutations — schema', () => {
  it('registers createSubmission mutation with form args', () => {
    const field = getMutationField('createSubmission');
    expect(field).toBeDefined();
    const argNames = field.args.map((a) => a.name);
    expect(argNames).toContain('title');
    expect(argNames).toContain('formDefinitionId');
    expect(argNames).toContain('formData');
  });

  it('registers updateSubmission mutation with formData arg', () => {
    const field = getMutationField('updateSubmission');
    expect(field).toBeDefined();
    const argNames = field.args.map((a) => a.name);
    expect(argNames).toContain('id');
    expect(argNames).toContain('title');
    expect(argNames).toContain('formData');
  });

  it('registers submitSubmission mutation', () => {
    const field = getMutationField('submitSubmission');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('id');
  });

  it('registers deleteSubmission mutation', () => {
    const field = getMutationField('deleteSubmission');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('id');
  });

  it('registers withdrawSubmission mutation', () => {
    const field = getMutationField('withdrawSubmission');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('id');
  });

  it('registers updateSubmissionStatus mutation', () => {
    const field = getMutationField('updateSubmissionStatus');
    expect(field).toBeDefined();
    const argNames = field.args.map((a) => a.name);
    expect(argNames).toContain('id');
    expect(argNames).toContain('status');
    expect(argNames).toContain('comment');
  });
});

describe('Submission mutations — resolver wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockReturnValue(makeOrgCtx());
    mockRequireScopes.mockResolvedValue(undefined);
  });

  it('createSubmission calls requireOrgContext + service', async () => {
    const submission = {
      id: 'sub-1',
      organizationId: 'org-1',
      submitterId: 'user-1',
      submissionPeriodId: null,
      title: 'Test',
      content: null,
      coverLetter: null,
      status: 'DRAFT' as const,
      formDefinitionId: null,
      formData: null,
      manuscriptVersionId: null,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      simSubOverride: false,
      simSubCheckResult: null,
      simSubCheckedAt: null,
      searchVector: null,
      transferredFromDomain: null,
      transferredFromTransferId: null,
      statusTokenHash: null,
      statusTokenExpiresAt: null,
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(submissionService.createWithAudit).mockResolvedValue(submission);

    const field = getMutationField('createSubmission');
    const result = await field.resolve!(
      {},
      {
        title: 'Test',
        content: null,
        coverLetter: null,
        submissionPeriodId: null,
      },
      makeCtx(),
      {} as never,
    );

    expect(mockRequireOrgContext).toHaveBeenCalled();
    expect(mockRequireScopes).toHaveBeenCalledWith(
      expect.anything(),
      'submissions:write',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.createWithAudit).toHaveBeenCalled();
    expect(result).toEqual(submission);
  });

  it('createSubmission guard failure prevents service call', async () => {
    mockRequireOrgContext.mockImplementation(() => {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    const field = getMutationField('createSubmission');
    await expect(
      field.resolve!({}, { title: 'X' }, makeCtx(), {} as never),
    ).rejects.toThrow('Not authenticated');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.createWithAudit).not.toHaveBeenCalled();
  });

  it('createSubmission validates input via Zod', async () => {
    const field = getMutationField('createSubmission');
    await expect(
      field.resolve!({}, { title: '' }, makeCtx(), {} as never),
    ).rejects.toThrow(); // Zod rejects empty title
  });

  it('updateSubmission validates id as UUID', async () => {
    const field = getMutationField('updateSubmission');
    await expect(
      field.resolve!(
        {},
        { id: 'not-a-uuid', title: 'X' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
  });

  it('deleteSubmission calls deleteAsOwner', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(submissionService.deleteAsOwner).mockResolvedValue({
      success: true,
    });

    const field = getMutationField('deleteSubmission');
    const result = await field.resolve!(
      {},
      { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.deleteAsOwner).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('updateSubmissionStatus calls updateStatusAsEditor', async () => {
    const payload = {
      submission: {
        id: 'sub-1',
        organizationId: 'org-1',
        submitterId: 'user-1',
        submissionPeriodId: null,
        formDefinitionId: null,
        formData: null,
        title: 'Test',
        content: null,
        coverLetter: null,
        status: 'UNDER_REVIEW' as const,
        manuscriptVersionId: null,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        simSubOverride: false,
        simSubCheckResult: null,
        simSubCheckedAt: null,
        searchVector: null,
        transferredFromDomain: null,
        transferredFromTransferId: null,
        statusTokenHash: null,
        statusTokenExpiresAt: null,
      },
      historyEntry: {
        id: 'hist-1',
        submissionId: 'sub-1',
        fromStatus: 'SUBMITTED' as const,
        toStatus: 'UNDER_REVIEW' as const,
        changedBy: 'user-1',
        comment: 'test',
        changedAt: new Date(),
      },
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(submissionService.updateStatusAsEditor).mockResolvedValue(
      payload,
    );

    const field = getMutationField('updateSubmissionStatus');
    const result = await field.resolve!(
      {},
      {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        status: 'UNDER_REVIEW',
        comment: 'test',
      },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.updateStatusAsEditor).toHaveBeenCalled();
    expect(result).toBe(payload);
  });

  it('mapServiceError is called on service failure', async () => {
    const error = new Error('Service failed');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(submissionService.createWithAudit).mockRejectedValue(error);

    const field = getMutationField('createSubmission');
    await expect(
      field.resolve!({}, { title: 'Test' }, makeCtx(), {} as never),
    ).rejects.toThrow();
    expect(mapServiceError).toHaveBeenCalledWith(error);
  });

  it('createSubmission passes formDefinitionId and formData to service', async () => {
    const formDefId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const submission = {
      id: 'sub-1',
      organizationId: 'org-1',
      submitterId: 'user-1',
      submissionPeriodId: null,
      title: 'Test',
      content: null,
      coverLetter: null,
      status: 'DRAFT' as const,
      formDefinitionId: formDefId,
      formData: { bio: 'Hello' },
      manuscriptVersionId: null,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      simSubOverride: false,
      simSubCheckResult: null,
      simSubCheckedAt: null,
      searchVector: null,
      transferredFromDomain: null,
      transferredFromTransferId: null,
      statusTokenHash: null,
      statusTokenExpiresAt: null,
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(submissionService.createWithAudit).mockResolvedValue(submission);

    const field = getMutationField('createSubmission');
    const result = await field.resolve!(
      {},
      {
        title: 'Test',
        content: null,
        coverLetter: null,
        submissionPeriodId: null,
        formDefinitionId: formDefId,
        formData: { bio: 'Hello' },
      },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.createWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        formDefinitionId: formDefId,
        formData: { bio: 'Hello' },
      }),
    );
    expect(result).toEqual(submission);
  });

  it('submission query validates id as UUID', async () => {
    const queryType = schema.getQueryType();
    const field = queryType!.getFields()['submission'];
    await expect(
      field.resolve!({}, { id: 'not-a-uuid' }, makeCtx(), {} as never),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.getByIdWithAccess).not.toHaveBeenCalled();
  });

  it('submissionHistory query validates submissionId as UUID', async () => {
    const queryType = schema.getQueryType();
    const field = queryType!.getFields()['submissionHistory'];
    await expect(
      field.resolve!(
        {},
        { submissionId: 'not-a-uuid' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.getHistoryWithAccess).not.toHaveBeenCalled();
  });

  it('updateSubmission passes formData to service', async () => {
    const submission = {
      id: 'sub-1',
      organizationId: 'org-1',
      submitterId: 'user-1',
      submissionPeriodId: null,
      title: 'Test',
      content: null,
      coverLetter: null,
      status: 'DRAFT' as const,
      formDefinitionId: null,
      formData: { bio: 'Updated' },
      manuscriptVersionId: null,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      simSubOverride: false,
      simSubCheckResult: null,
      simSubCheckedAt: null,
      searchVector: null,
      transferredFromDomain: null,
      transferredFromTransferId: null,
      statusTokenHash: null,
      statusTokenExpiresAt: null,
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(submissionService.updateAsOwner).mockResolvedValue(submission);

    const field = getMutationField('updateSubmission');
    const result = await field.resolve!(
      {},
      {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: null,
        content: null,
        coverLetter: null,
        formData: { bio: 'Updated' },
      },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(submissionService.updateAsOwner).toHaveBeenCalledWith(
      expect.anything(),
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      expect.objectContaining({
        formData: { bio: 'Updated' },
      }),
    );
    expect(result).toEqual(submission);
  });
});
