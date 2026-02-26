import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UIExtensionDeclaration } from '@colophony/plugin-sdk';
import type { TRPCContext } from '../context.js';

const { mockGetGlobalExtensions } = vi.hoisted(() => {
  const mockGetGlobalExtensions = vi.fn(() => [] as UIExtensionDeclaration[]);
  return { mockGetGlobalExtensions };
});

vi.mock('../../adapters/extensions-accessor.js', () => ({
  getGlobalExtensions: mockGetGlobalExtensions,
}));

import { appRouter } from '../router.js';

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
  overrides: Partial<TRPCContext> = {},
): TRPCContext {
  const mockTx = {} as never;
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: 'org-1',
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

const sampleExtensions: UIExtensionDeclaration[] = [
  {
    point: 'dashboard.widget',
    id: 'widget-1',
    label: 'Widget 1',
    component: 'test.widget',
    order: 10,
  },
  {
    point: 'settings.section',
    id: 'settings-1',
    label: 'Settings 1',
    component: 'test.settings',
    requiredPermissions: ['settings:read'],
    order: 20,
  },
  {
    point: 'dashboard.widget',
    id: 'widget-2',
    label: 'Widget 2',
    component: 'test.widget2',
    requiredPermissions: ['database:write'],
    order: 5,
  },
];

describe('plugins router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGlobalExtensions.mockReturnValue(sampleExtensions);
  });

  describe('listExtensions', () => {
    it('returns all extensions for ADMIN', async () => {
      const caller = createCaller(orgContext('ADMIN'));
      const result = await caller.plugins.listExtensions({});

      expect(result).toHaveLength(3);
    });

    it('filters by requiredPermissions for READER', async () => {
      const caller = createCaller(orgContext('READER'));
      const result = await caller.plugins.listExtensions({});

      // READER has no settings:read or database:write
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('widget-1');
    });

    it('filters by point', async () => {
      const caller = createCaller(orgContext('ADMIN'));
      const result = await caller.plugins.listExtensions({
        point: 'dashboard.widget',
      });

      expect(result).toHaveLength(2);
      expect(result.every((e: any) => e.point === 'dashboard.widget')).toBe(
        true,
      );
    });

    it('sorts by order ascending, nullish last', async () => {
      mockGetGlobalExtensions.mockReturnValue([
        {
          point: 'dashboard.widget',
          id: 'no-order',
          label: 'No Order',
          component: 'a',
        },
        {
          point: 'dashboard.widget',
          id: 'order-50',
          label: 'Order 50',
          component: 'b',
          order: 50,
        },
        {
          point: 'dashboard.widget',
          id: 'order-10',
          label: 'Order 10',
          component: 'c',
          order: 10,
        },
      ]);

      const caller = createCaller(orgContext('ADMIN'));
      const result = await caller.plugins.listExtensions({});

      expect(result.map((e: any) => e.id)).toEqual([
        'order-10',
        'order-50',
        'no-order',
      ]);
    });

    it('returns empty when no extensions', async () => {
      mockGetGlobalExtensions.mockReturnValue([]);
      const caller = createCaller(orgContext('ADMIN'));
      const result = await caller.plugins.listExtensions({});

      expect(result).toEqual([]);
    });

    it('requires org context', async () => {
      const caller = createCaller(
        makeContext({
          authContext: {
            userId: 'user-1',
            zitadelUserId: 'zid-1',
            email: 'test@example.com',
            emailVerified: true,
            authMethod: 'test',
            orgId: undefined as any,
            role: undefined as any,
          },
        }),
      );

      await expect(caller.plugins.listExtensions({})).rejects.toThrow(
        /Organization/i,
      );
    });

    it('rejects unauthenticated', async () => {
      const caller = createCaller(makeContext());

      await expect(caller.plugins.listExtensions({})).rejects.toThrow(
        /authenticated/i,
      );
    });
  });
});
