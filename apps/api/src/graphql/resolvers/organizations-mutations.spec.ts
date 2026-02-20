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

import { requireAuth, requireAdmin, requireScopes } from '../guards.js';
import { organizationService } from '../../services/organization.service.js';

const mockRequireAuth = vi.mocked(requireAuth);
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

function makeAuthedCtx() {
  const ctx = makeCtx();
  return { ...ctx, authContext: ctx.authContext as AuthContext };
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
  const fields = schema.getMutationType()!.getFields();
  return fields[name];
}

describe('Organization mutations — schema', () => {
  it('registers all 5 organization mutations', () => {
    const names = [
      'createOrganization',
      'updateOrganization',
      'addOrganizationMember',
      'removeOrganizationMember',
      'updateOrganizationMemberRole',
    ];
    for (const name of names) {
      expect(getMutationField(name)).toBeDefined();
    }
  });

  it('createOrganization has name and slug args', () => {
    const field = getMutationField('createOrganization');
    const argNames = field.args.map((a) => a.name);
    expect(argNames).toContain('name');
    expect(argNames).toContain('slug');
  });
});

describe('Organization mutations — resolver wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockReturnValue(makeAuthedCtx());
    mockRequireAdmin.mockReturnValue(makeAdminCtx());
    mockRequireScopes.mockResolvedValue(undefined);
  });

  it('createOrganization uses requireAuth and calls createWithAudit', async () => {
    const result_data = {
      organization: {
        id: 'org-new',
        name: 'New Org',
        slug: 'new-org',
        settings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      membership: {
        id: 'mem-1',
        organizationId: 'org-new',
        userId: 'user-1',
        role: 'ADMIN' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(organizationService.createWithAudit).mockResolvedValue(
      result_data,
    );

    const field = getMutationField('createOrganization');
    const result = await field.resolve!(
      {},
      { name: 'New Org', slug: 'new-org' },
      makeCtx(),
      {} as never,
    );

    expect(mockRequireAuth).toHaveBeenCalled();
    expect(mockRequireScopes).toHaveBeenCalledWith(
      expect.anything(),
      'organizations:write',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.createWithAudit).toHaveBeenCalled();
    expect(result).toBe(result_data);
  });

  it('updateOrganization uses requireAdmin', async () => {
    const updated = {
      id: 'org-1',
      name: 'Updated',
      slug: 'my-org',
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(organizationService.updateWithAudit).mockResolvedValue(updated);

    const field = getMutationField('updateOrganization');
    await field.resolve!(
      {},
      { name: 'Updated', settings: null },
      makeCtx(),
      {} as never,
    );

    expect(mockRequireAdmin).toHaveBeenCalled();
  });

  it('addOrganizationMember validates email + role via Zod', async () => {
    const field = getMutationField('addOrganizationMember');
    // Invalid role should fail Zod validation
    await expect(
      field.resolve!(
        {},
        { email: 'x@test.com', role: 'SUPERADMIN' },
        makeCtx(),
        {} as never,
      ),
    ).rejects.toThrow();
  });

  it('removeOrganizationMember validates memberId as UUID', async () => {
    const field = getMutationField('removeOrganizationMember');
    await expect(
      field.resolve!({}, { memberId: 'not-a-uuid' }, makeCtx(), {} as never),
    ).rejects.toThrow();
  });

  it('updateOrganizationMemberRole calls service with validated args', async () => {
    const updated = {
      id: 'mem-1',
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'EDITOR' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(organizationService.updateMemberRoleWithAudit).mockResolvedValue(
      updated,
    );

    const field = getMutationField('updateOrganizationMemberRole');
    const result = await field.resolve!(
      {},
      { memberId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'EDITOR' },
      makeCtx(),
      {} as never,
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.updateMemberRoleWithAudit).toHaveBeenCalled();
    expect(result).toBe(updated);
  });

  it('createOrganization guard failure prevents service call', async () => {
    mockRequireAuth.mockImplementation(() => {
      throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    });

    const field = getMutationField('createOrganization');
    await expect(
      field.resolve!({}, { name: 'X', slug: 'x' }, makeCtx(), {} as never),
    ).rejects.toThrow('Not authenticated');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.createWithAudit).not.toHaveBeenCalled();
  });
});
