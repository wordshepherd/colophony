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

vi.mock('../../services/api-key.service.js', () => ({
  apiKeyService: {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    delete: vi.fn(),
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

vi.mock('../../services/file.service.js', () => ({
  fileService: { deleteAsOwner: vi.fn() },
  FileNotFoundError: class extends Error {
    name = 'FileNotFoundError';
  },
  FileNotCleanError: class extends Error {
    name = 'FileNotCleanError';
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

import { requireOrgContext, requireAdmin, requireScopes } from '../guards.js';
import { apiKeyService } from '../../services/api-key.service.js';

const mockRequireOrgContext = vi.mocked(requireOrgContext);
const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRequireScopes = vi.mocked(requireScopes);

import { schema } from '../schema.js';

function makeCtx(): GraphQLContext {
  return {
    authContext: {
      userId: 'user-1',
      email: 'admin@example.com',
      emailVerified: true,
      authMethod: 'oidc' as const,
      orgId: 'org-1',
      role: 'ADMIN' as const,
    },
    dbTx: {} as DrizzleDb,
    audit: vi.fn().mockResolvedValue(undefined),
    loaders: {} as GraphQLContext['loaders'],
  };
}

function makeAdminCtx() {
  const ctx = makeCtx();
  return {
    ...ctx,
    authContext: ctx.authContext as AuthContext & {
      orgId: string;
      role: 'ADMIN';
    },
    dbTx: ctx.dbTx as DrizzleDb,
  };
}

function getMutationField(name: string) {
  return schema.getMutationType()!.getFields()[name];
}

function getQueryField(name: string) {
  return schema.getQueryType()!.getFields()[name];
}

describe('API key resolvers — schema', () => {
  it('registers apiKeys query', () => {
    expect(getQueryField('apiKeys')).toBeDefined();
  });

  it('registers all 3 API key mutations', () => {
    for (const name of ['createApiKey', 'revokeApiKey', 'deleteApiKey']) {
      expect(getMutationField(name)).toBeDefined();
    }
  });

  it('createApiKey has name, scopes, expiresAt args', () => {
    const argNames = getMutationField('createApiKey').args.map((a) => a.name);
    expect(argNames).toEqual(
      expect.arrayContaining(['name', 'scopes', 'expiresAt']),
    );
  });
});

describe('API key mutations — resolver wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockReturnValue(makeAdminCtx());
    mockRequireAdmin.mockReturnValue(makeAdminCtx());
    mockRequireScopes.mockResolvedValue(undefined);
  });

  it('createApiKey calls service and audits', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(apiKeyService.create).mockResolvedValue({
      id: 'key-1',
      name: 'CI Key',
      scopes: ['submissions:read'] as string[],
      keyPrefix: 'col_live_',
      plainTextKey: 'col_live_abc',
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
    });

    const ctx = makeCtx();
    const field = getMutationField('createApiKey');
    const result = await field.resolve!(
      {},
      { name: 'CI Key', scopes: ['submissions:read'], expiresAt: null },
      ctx,
      {} as never,
    );

    expect(mockRequireAdmin).toHaveBeenCalled();
    expect(mockRequireScopes).toHaveBeenCalledWith(
      expect.anything(),
      'api-keys:manage',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(apiKeyService.create).toHaveBeenCalled();
    expect(ctx.audit).toHaveBeenCalled();
    expect((result as { plainTextKey: string }).plainTextKey).toBe(
      'col_live_abc',
    );
  });

  it('revokeApiKey throws NOT_FOUND when null', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(apiKeyService.revoke).mockResolvedValue(null as never);

    const field = getMutationField('revokeApiKey');
    await expect(
      field.resolve!(
        {},
        { keyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow('API key not found');
  });

  it('revokeApiKey returns revoked key and audits', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(apiKeyService.revoke).mockResolvedValue({
      id: 'key-1',
      name: 'CI Key',
      revokedAt: new Date(),
    });

    const ctx = makeCtx();
    const field = getMutationField('revokeApiKey');
    const result = await field.resolve!(
      {},
      { keyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      ctx,
      {} as never,
    );

    expect((result as { name: string }).name).toBe('CI Key');
    expect(ctx.audit).toHaveBeenCalled();
  });

  it('deleteApiKey throws NOT_FOUND when null', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(apiKeyService.delete).mockResolvedValue(null as never);

    const field = getMutationField('deleteApiKey');
    await expect(
      field.resolve!(
        {},
        { keyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow('API key not found');
  });

  it('deleteApiKey returns success and audits', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(apiKeyService.delete).mockResolvedValue({ id: 'key-1' });

    const ctx = makeCtx();
    const field = getMutationField('deleteApiKey');
    const result = await field.resolve!(
      {},
      { keyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      ctx,
      {} as never,
    );

    expect((result as { success: boolean }).success).toBe(true);
    expect(ctx.audit).toHaveBeenCalled();
  });

  it('admin guard failure prevents service call', async () => {
    mockRequireAdmin.mockImplementation(() => {
      throw new GraphQLError('Admin role required', {
        extensions: { code: 'FORBIDDEN' },
      });
    });

    const field = getMutationField('createApiKey');
    await expect(
      field.resolve!(
        {},
        { name: 'X', scopes: ['submissions:read'] },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow('Admin role required');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(apiKeyService.create).not.toHaveBeenCalled();
  });

  it('apiKeys query enforces org context + scope', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(apiKeyService.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const field = getQueryField('apiKeys');
    await field.resolve!({}, { page: 1, limit: 20 }, makeCtx(), {} as never);

    expect(mockRequireOrgContext).toHaveBeenCalled();
    expect(mockRequireScopes).toHaveBeenCalledWith(
      expect.anything(),
      'api-keys:read',
    );
  });
});
