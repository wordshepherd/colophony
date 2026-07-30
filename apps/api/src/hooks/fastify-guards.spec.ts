/**
 * Unit tests for the Fastify API key guards.
 *
 * These carry the behavioural half of the surface's coverage guarantee.
 * `fastify-guard-coverage.spec.ts` proves every non-public route *declares* a
 * guard; this file proves a declared guard *rejects*, and that `guardScope`
 * installs exactly the functions it declares. The two together are what make the
 * gate meaningful — a declaration test alone would pass unchanged if these guards
 * stopped denying anything.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

import { requireScopes, internalOnly, guardScope } from './fastify-guards.js';
import { readGuardTags, markGuard } from '../services/scope-check.js';
import { applyGuardEnv } from '../__tests__/helpers/guard-env.js';

const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
}));

const mockAuditLog = vi.fn();
// `principalFromAuthContext` is the real implementation on purpose — the
// fallback path must derive the same principal the request-transaction path
// does, and a stub here would assert nothing.
vi.mock('../services/audit.service.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../services/audit.service.js')>();
  return {
    auditService: {
      log: (...args: unknown[]) => mockAuditLog(...args),
    },
    principalFromAuthContext: actual.principalFromAuthContext,
  };
});

const apiKeyContext = {
  userId: '00000000-0000-4000-a000-000000000001',
  email: 'key@example.com',
  emailVerified: true,
  authMethod: 'apikey' as const,
  apiKeyId: '00000000-0000-4000-a000-0000000000ff',
  apiKeyScopes: ['notifications:read'],
  orgId: '00000000-0000-4000-a000-000000000010',
  roles: ['ADMIN'],
};

const oidcContext = {
  ...apiKeyContext,
  authMethod: 'oidc' as const,
  apiKeyId: undefined,
  apiKeyScopes: undefined,
};

/**
 * Build an app whose one route carries the given guards, standing in for the
 * auth/org-context/db-context/audit hooks the real chain provides.
 */
async function buildApp(options: {
  authContext: Record<string, unknown> | null;
  guards?: Parameters<typeof guardScope>[1][];
  scopeGuards?: Parameters<typeof guardScope>[1][];
  withTransaction?: boolean;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorateRequest('authContext', null);
  app.decorateRequest('dbTx', null);
  app.decorateRequest('audit', async () => {});

  app.addHook('preHandler', async (request) => {
    request.authContext = options.authContext as never;
    if (options.withTransaction) {
      request.dbTx = {} as never;
      request.audit = mockRequestAudit as never;
    }
  });

  if (options.scopeGuards) {
    guardScope(app, ...options.scopeGuards);
  }

  app.get(
    '/probe',
    options.guards ? { preHandler: options.guards } : {},
    async () => ({ ok: true }),
  );

  await app.ready();
  return app;
}

const mockRequestAudit = vi.fn();

describe('fastify-guards', () => {
  let restoreEnv: () => void;

  beforeAll(() => {
    restoreEnv = applyGuardEnv({ INTERNAL_ONLY_ENFORCE: 'true' });
  });

  afterAll(() => {
    restoreEnv();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    // withRls runs its callback against a stub transaction by default.
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
        fn({ execute: vi.fn() }),
    );
  });

  afterEach(() => {
    delete process.env.INTERNAL_ONLY_ENFORCE;
    process.env.INTERNAL_ONLY_ENFORCE = 'true';
  });

  describe('requireScopes', () => {
    it('is tagged so the coverage gate can see it', () => {
      const guard = requireScopes('notifications:read');
      expect(readGuardTags([guard])).toEqual([
        { kind: 'scopes', scopes: ['notifications:read'] },
      ]);
    });

    it('mints a distinct closure per call', () => {
      // Why tagging is necessary at all: guards are not identifiable by
      // reference, so the gate cannot compare against a known function.
      expect(requireScopes('notifications:read')).not.toBe(
        requireScopes('notifications:read'),
      );
    });

    it('returns 401 when unauthenticated', async () => {
      const app = await buildApp({
        authContext: null,
        guards: [requireScopes('notifications:read')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('allows a key holding the scope', async () => {
      const app = await buildApp({
        authContext: apiKeyContext,
        guards: [requireScopes('notifications:read')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('denies a key missing the scope with a machine-readable body', async () => {
      const app = await buildApp({
        authContext: apiKeyContext,
        guards: [requireScopes('notifications:write')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        error: 'insufficient_scope',
        required: ['notifications:write'],
        missing: ['notifications:write'],
      });
      await app.close();
    });

    it('bypasses the check for an interactive session', async () => {
      // Scopes are API-key-only, which is why adding a guard to a route cannot
      // break the web app or Playwright E2E.
      const app = await buildApp({
        authContext: oidcContext,
        guards: [requireScopes('notifications:write')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('reports every missing scope, not just the first', async () => {
      const app = await buildApp({
        authContext: apiKeyContext,
        guards: [requireScopes('notifications:write', 'webhooks:manage')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.json().missing).toEqual([
        'notifications:write',
        'webhooks:manage',
      ]);
      await app.close();
    });
  });

  describe('internalOnly', () => {
    it('is tagged so the coverage gate can see it', () => {
      expect(readGuardTags([internalOnly])).toEqual([{ kind: 'internal' }]);
    });

    it('returns 401 when unauthenticated, without auditing', async () => {
      const app = await buildApp({
        authContext: null,
        scopeGuards: [internalOnly],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(401);
      expect(mockAuditLog).not.toHaveBeenCalled();
      await app.close();
    });

    it('allows an interactive session', async () => {
      const app = await buildApp({
        authContext: oidcContext,
        scopeGuards: [internalOnly],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('rejects an API key when enforcing, whatever scopes it holds', async () => {
      process.env.INTERNAL_ONLY_ENFORCE = 'true';
      const app = await buildApp({
        authContext: { ...apiKeyContext, apiKeyScopes: ['notifications:read'] },
        scopeGuards: [internalOnly],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        error: 'forbidden',
        message: 'This route is not available to API keys',
      });
      await app.close();
    });

    it('lets an API key through in log-only mode', async () => {
      // The revert lever, not a normal setting.
      process.env.INTERNAL_ONLY_ENFORCE = 'false';
      const app = await buildApp({
        authContext: apiKeyContext,
        scopeGuards: [internalOnly],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('audits the crossing in both modes', async () => {
      for (const enforced of ['true', 'false']) {
        vi.resetAllMocks();
        mockWithRls.mockImplementation(
          async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
            fn({ execute: vi.fn() }),
        );
        process.env.INTERNAL_ONLY_ENFORCE = enforced;

        const app = await buildApp({
          authContext: apiKeyContext,
          scopeGuards: [internalOnly],
        });
        await app.inject({ method: 'GET', url: '/probe' });

        expect(mockAuditLog, `enforced=${enforced}`).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: 'API_KEY_INTERNAL_ROUTE',
            newValue: expect.objectContaining({
              route: '/probe',
              authMethod: 'apikey',
              enforced: enforced === 'true',
            }),
          }),
        );
        await app.close();
      }
    });

    it('rejects a credential class that is not on the allowlist', async () => {
      // The allowlist-not-denylist property: a future `col_svc_` principal
      // carrying its own authMethod is excluded by construction.
      const app = await buildApp({
        authContext: { ...apiKeyContext, authMethod: 'service-principal' },
        scopeGuards: [internalOnly],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });

  describe('audit durability', () => {
    it('uses request.audit when a transaction exists', async () => {
      const app = await buildApp({
        authContext: apiKeyContext,
        guards: [requireScopes('notifications:write')],
        withTransaction: true,
      });

      await app.inject({ method: 'GET', url: '/probe' });
      expect(mockRequestAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'API_KEY_SCOPE_DENIED' }),
      );
      expect(mockWithRls).not.toHaveBeenCalled();
      await app.close();
    });

    it('falls back to withRls when there is no transaction', async () => {
      // The SSE route: db-context skips it, so request.audit is a warn-only stub
      // and a denial would otherwise persist nothing at all.
      const app = await buildApp({
        authContext: apiKeyContext,
        guards: [requireScopes('notifications:write')],
        withTransaction: false,
      });

      await app.inject({ method: 'GET', url: '/probe' });

      expect(mockWithRls).toHaveBeenCalledWith(
        { orgId: apiKeyContext.orgId, userId: apiKeyContext.userId },
        expect.any(Function),
      );
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'API_KEY_SCOPE_DENIED',
          organizationId: apiKeyContext.orgId,
          actorId: apiKeyContext.userId,
          route: '/probe',
          method: 'GET',
          // Rows from this path must be indistinguishable from the
          // request-transaction path, principal included.
          principalId: apiKeyContext.apiKeyId,
          principalType: 'api_key',
        }),
      );
      await app.close();
    });

    it('still denies when the audit write fails', async () => {
      // An audit failure is a monitoring problem; a 500 in place of the 403 would
      // be an availability one, and would also let the caller through on retry.
      mockWithRls.mockRejectedValue(new Error('connection refused'));

      const app = await buildApp({
        authContext: apiKeyContext,
        guards: [requireScopes('notifications:write')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('does not throw when there is no org context to scope the row to', async () => {
      const app = await buildApp({
        authContext: { ...apiKeyContext, orgId: undefined },
        guards: [requireScopes('notifications:write')],
      });

      const res = await app.inject({ method: 'GET', url: '/probe' });
      expect(res.statusCode).toBe(403);
      expect(mockWithRls).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('guardScope', () => {
    it('installs exactly the guards it declares', async () => {
      // This is the link that lets the coverage gate assert declarations and
      // trust that enforcement follows. If tags could be produced without the
      // corresponding hook, the gate would be decorative.
      const app = Fastify({ logger: false });
      const installed: unknown[] = [];
      const originalAddHook = app.addHook.bind(app);
      vi.spyOn(app, 'addHook').mockImplementation(
        (name: string, fn: unknown) => {
          if (name === 'preHandler') installed.push(fn);
          return originalAddHook(name as never, fn as never);
        },
      );

      const scopeGuard = requireScopes('notifications:read');
      guardScope(app, internalOnly, scopeGuard);

      expect(installed).toEqual([internalOnly, scopeGuard]);
      await app.close();
    });

    it('declares its guards on every route in the scope', async () => {
      const app = Fastify({ logger: false });
      guardScope(app, internalOnly);

      // Collected per route. Fastify synthesises a HEAD route from each GET and
      // fires onRoute for it too, so filter to the declared method.
      const tags: unknown[] = [];
      app.addHook('onRoute', (routeOptions) => {
        if (routeOptions.method === 'GET') {
          tags.push(routeOptions.config?.guardTags);
        }
      });

      app.get('/a', async () => ({}));
      app.get('/b', async () => ({}));
      app.post('/c', async () => ({}));

      await app.ready();
      expect(tags).toEqual([[{ kind: 'internal' }], [{ kind: 'internal' }]]);
      await app.close();
    });

    it('refuses an untagged guard', async () => {
      // An untagged guard would enforce correctly while reading as unguarded to
      // the gate — the one failure mode that is invisible in both directions.
      const app = Fastify({ logger: false });
      const untagged = async () => {};

      expect(() => guardScope(app, untagged)).toThrow(/untagged guard/);
      await app.close();
    });

    it('accumulates tags rather than replacing them', async () => {
      const app = Fastify({ logger: false });
      guardScope(app, internalOnly);
      guardScope(app, requireScopes('notifications:read'));

      const tags: unknown[] = [];
      app.addHook('onRoute', (routeOptions) => {
        tags.push(routeOptions.config?.guardTags);
      });
      app.get('/probe', async () => ({}));

      await app.ready();
      expect(tags[0]).toEqual([
        { kind: 'internal' },
        { kind: 'scopes', scopes: ['notifications:read'] },
      ]);
      await app.close();
    });

    it('preserves unrelated route config', async () => {
      const app = Fastify({ logger: false });
      guardScope(app, internalOnly);

      const configs: unknown[] = [];
      app.addHook('onRoute', (routeOptions) => {
        configs.push(routeOptions.config);
      });
      app.get(
        '/probe',
        { config: { rateLimit: 5 } as never },
        async () => ({}),
      );

      await app.ready();
      expect(configs[0]).toMatchObject({
        rateLimit: 5,
        guardTags: [{ kind: 'internal' }],
      });
      await app.close();
    });
  });

  describe('markGuard', () => {
    it('stores the tag non-enumerably so it survives normal object handling', () => {
      const fn = markGuard(async () => {}, { kind: 'internal' });
      expect(Object.keys(fn)).toEqual([]);
      expect(readGuardTags([fn])).toEqual([{ kind: 'internal' }]);
    });
  });
});
