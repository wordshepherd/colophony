import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../context.js';
import type { AuthContext } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Mocks
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

vi.mock('../../services/file.service.js', () => ({
  fileService: { deleteAsOwner: vi.fn() },
  FileNotFoundError: class extends Error {
    name = 'FileNotFoundError';
  },
  FileNotCleanError: class extends Error {
    name = 'FileNotCleanError';
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
import { fileService } from '../../services/file.service.js';
import { mapServiceError } from '../error-mapper.js';

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockRequireScopes = vi.mocked(requireScopes);

import { schema } from '../schema.js';

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
  return schema.getMutationType()!.getFields()[name];
}

describe('File mutations — schema', () => {
  it('registers deleteFile mutation', () => {
    const field = getMutationField('deleteFile');
    expect(field).toBeDefined();
    expect(field.args.map((a) => a.name)).toContain('fileId');
  });
});

describe('File mutations — resolver wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockReturnValue(makeOrgCtx());
    mockRequireScopes.mockResolvedValue(undefined);
  });

  it('deleteFile calls requireOrgContext + files:write scope + service', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(fileService.deleteAsOwner).mockResolvedValue({ success: true });

    const field = getMutationField('deleteFile');
    const result = await field.resolve!(
      {},
      { fileId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      makeCtx(),
      {} as never,
    );

    expect(mockRequireOrgContext).toHaveBeenCalled();
    expect(mockRequireScopes).toHaveBeenCalledWith(
      expect.anything(),
      'files:write',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fileService.deleteAsOwner).toHaveBeenCalled();
    expect((result as { success: boolean }).success).toBe(true);
  });

  it('deleteFile validates fileId as UUID', async () => {
    const field = getMutationField('deleteFile');
    await expect(
      field.resolve!({}, { fileId: 'not-a-uuid' }, makeCtx(), {} as never),
    ).rejects.toThrow();
  });

  it('deleteFile guard failure prevents service call', async () => {
    mockRequireOrgContext.mockImplementation(() => {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    const field = getMutationField('deleteFile');
    await expect(
      field.resolve!(
        {},
        { fileId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow('Not authenticated');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fileService.deleteAsOwner).not.toHaveBeenCalled();
  });

  it('deleteFile maps service errors', async () => {
    const error = new Error('File not found');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(fileService.deleteAsOwner).mockRejectedValue(error);

    const field = getMutationField('deleteFile');
    await expect(
      field.resolve!(
        {},
        { fileId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
    expect(mapServiceError).toHaveBeenCalledWith(error);
  });
});
