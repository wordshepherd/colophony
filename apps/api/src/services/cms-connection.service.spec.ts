import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditActions, AuditResources } from '@colophony/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTestConnection = vi.fn();

vi.mock('../adapters/cms/index.js', () => ({
  getCmsAdapter: () => ({ testConnection: mockTestConnection }),
}));

vi.mock('./errors.js', () => ({
  assertEditorOrAdmin: vi.fn(),
}));

vi.mock('@colophony/db', () => ({
  cmsConnections: {
    id: 'id',
    organizationId: 'organization_id',
    publicationId: 'publication_id',
    isActive: 'is_active',
    createdAt: 'created_at',
  },
  eq: vi.fn((_col: unknown, val: unknown) => ({ op: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
  count: vi.fn(),
}));

import { cmsConnectionService } from './cms-connection.service.js';
import type { ServiceContext } from './types.js';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeServiceContext(
  overrides: Partial<ServiceContext> = {},
): ServiceContext {
  return {
    tx: makeTx(),
    actor: { userId: 'user-1', orgId: 'org-1', roles: ['ADMIN'] },
    audit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeTx(): DrizzleDb {
  const updateReturning = vi
    .fn()
    .mockResolvedValue([{ id: 'conn-1', name: 'Updated' }]);
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const selectLimitResult = vi.fn().mockResolvedValue([
    {
      id: 'conn-1',
      name: 'Test Connection',
      adapterType: 'GHOST',
      config: { url: 'https://example.com', adminApiKey: 'secret123' },
      isActive: true,
      organizationId: 'org-1',
      publicationId: null,
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: selectLimitResult,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
  } as unknown as DrizzleDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cmsConnectionService.updateWithAudit', () => {
  it('does not log config values', async () => {
    const ctx = makeServiceContext();
    const input = {
      name: 'New Name',
      config: { url: 'https://example.com', adminApiKey: 'supersecret' },
      isActive: true,
    };

    await cmsConnectionService.updateWithAudit(ctx, 'conn-1', input);

    expect(ctx.audit).toHaveBeenCalledOnce();
    const auditCall = (ctx.audit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.action).toBe(AuditActions.CMS_CONNECTION_UPDATED);
    expect(auditCall.resource).toBe(AuditResources.CMS_CONNECTION);
    expect(auditCall.newValue).toEqual({
      name: 'New Name',
      isActive: true,
      configUpdated: true,
    });
    // Must NOT contain raw config
    expect(auditCall.newValue.config).toBeUndefined();
    expect(auditCall.newValue.adminApiKey).toBeUndefined();
    expect(auditCall.newValue.url).toBeUndefined();
  });
});

describe('cmsConnectionService.testConnectionWithAudit', () => {
  beforeEach(() => {
    mockTestConnection.mockReset();
  });

  it('logs success result', async () => {
    mockTestConnection.mockResolvedValue({ success: true });
    const ctx = makeServiceContext();

    const result = await cmsConnectionService.testConnectionWithAudit(
      ctx,
      'conn-1',
    );

    expect(result).toEqual({ success: true });
    expect(ctx.audit).toHaveBeenCalledOnce();
    const auditCall = (ctx.audit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.action).toBe(AuditActions.CMS_CONNECTION_TESTED);
    expect(auditCall.resource).toBe(AuditResources.CMS_CONNECTION);
    expect(auditCall.resourceId).toBe('conn-1');
    expect(auditCall.newValue).toEqual({ success: true });
  });

  it('logs failure result without error text', async () => {
    mockTestConnection.mockResolvedValue({
      success: false,
      error:
        'Connection refused: HTTP 401 Unauthorized with body containing apiKey=secret123',
    });
    const ctx = makeServiceContext();

    const result = await cmsConnectionService.testConnectionWithAudit(
      ctx,
      'conn-1',
    );

    expect(result.success).toBe(false);
    expect(ctx.audit).toHaveBeenCalledOnce();
    const auditCall = (ctx.audit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.action).toBe(AuditActions.CMS_CONNECTION_TESTED);
    expect(auditCall.newValue).toEqual({ success: false });
    // Must NOT leak error text into audit log
    expect(auditCall.newValue.error).toBeUndefined();
  });

  it('audits failure and re-throws when testConnection throws', async () => {
    mockTestConnection.mockRejectedValue(new Error('Config parse error'));
    const ctx = makeServiceContext();

    await expect(
      cmsConnectionService.testConnectionWithAudit(ctx, 'conn-1'),
    ).rejects.toThrow('Config parse error');

    expect(ctx.audit).toHaveBeenCalledOnce();
    const auditCall = (ctx.audit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.action).toBe(AuditActions.CMS_CONNECTION_TESTED);
    expect(auditCall.newValue).toEqual({ success: false });
  });
});

// ---------------------------------------------------------------------------
// Defense-in-depth org filtering
// ---------------------------------------------------------------------------

describe('cmsConnectionService defense-in-depth org filtering', () => {
  function makeTxNoRows(): DrizzleDb {
    const updateReturning = vi.fn().mockResolvedValue([]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const deleteReturning = vi.fn().mockResolvedValue([]);
    const deleteWhere = vi.fn().mockReturnValue({ returning: deleteReturning });
    const selectLimitResult = vi.fn().mockResolvedValue([]);
    return {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectLimitResult,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      delete: vi.fn().mockReturnValue({ where: deleteWhere }),
    } as unknown as DrizzleDb;
  }

  it('update returns null when orgId does not match', async () => {
    const tx = makeTxNoRows();
    const result = await cmsConnectionService.update(
      tx,
      'conn-1',
      { name: 'Changed' },
      'wrong-org',
    );
    expect(result).toBeNull();
  });

  it('update succeeds when orgId matches', async () => {
    const tx = makeTx();
    const result = await cmsConnectionService.update(
      tx,
      'conn-1',
      { name: 'Changed' },
      'org-1',
    );
    expect(result).not.toBeNull();
  });

  it('delete returns null when orgId does not match', async () => {
    const tx = makeTxNoRows();
    const result = await cmsConnectionService.delete(tx, 'conn-1', 'wrong-org');
    expect(result).toBeNull();
  });

  it('testConnection throws when orgId does not match (getById returns null)', async () => {
    const tx = makeTxNoRows();
    await expect(
      cmsConnectionService.testConnection(tx, 'conn-1', 'wrong-org'),
    ).rejects.toThrow('CMS connection "conn-1" not found');
  });

  it('updateWithAudit passes actor.orgId to inner update', async () => {
    const ctx = makeServiceContext();
    const spy = vi.spyOn(cmsConnectionService, 'update');
    await cmsConnectionService.updateWithAudit(ctx, 'conn-1', {
      name: 'New',
    });
    expect(spy).toHaveBeenCalledWith(
      ctx.tx,
      'conn-1',
      { name: 'New' },
      'org-1',
    );
    spy.mockRestore();
  });
});
