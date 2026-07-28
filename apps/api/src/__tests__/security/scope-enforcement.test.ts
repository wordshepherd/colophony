/**
 * End-to-end scope and internal-boundary enforcement for API keys.
 *
 * These drive a real `api_keys` row through the real auth hook and the real
 * tRPC router, so they cover what the unit tests cannot: that
 * `verify_api_key()` resolves the key, that `requireScopes` actually denies an
 * under-scoped one, and that `internalOnly` rejects a key while admitting an
 * interactive session.
 *
 * This suite exists because the Playwright suites used to provide that
 * coverage incidentally — they authenticated as API keys. They now use the
 * interactive test path, for which `requireScopes` is a no-op, so the
 * enforcement evidence has to live here.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from '../rls/helpers/factories.js';
import {
  buildApiKeyApp,
  buildInteractiveApp,
  insertApiKey,
  recentAuditActions,
} from './helpers/auth-app.js';

/** A scope-guarded orgProcedure: requireScopes('notifications:read'). */
const SCOPED_ROUTE = '/trpc/notifications.unreadCount';
/** An internalAuthedProcedure — no role requirement, so only the guard differs. */
const INTERNAL_ROUTE = '/trpc/migrations.list';
const INTERNAL_INPUT = encodeURIComponent(JSON.stringify({}));

let app: FastifyInstance;

async function seedOrgWithAdmin() {
  const org = await createOrganization();
  const user = await createUser();
  // createOrgMember defaults roles to ['ADMIN'].
  await createOrgMember(org.id, user.id);
  return { org, user };
}

/**
 * `internalOnly` reads the flag via `validateEnv()` — i.e. straight from
 * process.env at request time, not from the Env handed to buildApp. Setting it
 * on the app would silently do nothing, so drive process.env instead.
 */
function setInternalOnlyEnforce(value: boolean): void {
  process.env.TRPC_INTERNAL_ONLY_ENFORCE = value ? 'true' : 'false';
}

const originalEnforce = process.env.TRPC_INTERNAL_ONLY_ENFORCE;

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await app?.close();
  await truncateAllTables();
  if (originalEnforce === undefined) {
    delete process.env.TRPC_INTERNAL_ONLY_ENFORCE;
  } else {
    process.env.TRPC_INTERNAL_ONLY_ENFORCE = originalEnforce;
  }
});

afterAll(async () => {
  await app?.close();
});

describe('requireScopes — real API key through the tRPC router', () => {
  it('denies an under-scoped key with 403 insufficient_scope', async () => {
    app = await buildApiKeyApp();
    const { org, user } = await seedOrgWithAdmin();
    const key = await insertApiKey({
      orgId: org.id,
      userId: user.id,
      // Deliberately omits notifications:read.
      scopes: ['submissions:read'],
    });

    const res = await app.inject({
      method: 'GET',
      url: SCOPED_ROUTE,
      headers: {
        'x-api-key': key.plainKey,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('notifications:read');
  });

  it('allows a correctly scoped key', async () => {
    app = await buildApiKeyApp();
    const { org, user } = await seedOrgWithAdmin();
    const key = await insertApiKey({
      orgId: org.id,
      userId: user.id,
      scopes: ['notifications:read'],
    });

    const res = await app.inject({
      method: 'GET',
      url: SCOPED_ROUTE,
      headers: {
        'x-api-key': key.plainKey,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).result.data.count).toBe(0);
  });

  it('writes an API_KEY_SCOPE_DENIED audit row on denial', async () => {
    app = await buildApiKeyApp();
    const { org, user } = await seedOrgWithAdmin();
    const key = await insertApiKey({
      orgId: org.id,
      userId: user.id,
      scopes: ['submissions:read'],
    });

    await app.inject({
      method: 'GET',
      url: SCOPED_ROUTE,
      headers: {
        'x-api-key': key.plainKey,
        'x-organization-id': org.id,
      },
    });

    // The row survives only because the tRPC adapter turns a TRPCError into a
    // normal reply, so db-context COMMITs rather than ROLLBACKs.
    expect(await recentAuditActions(org.id)).toContain('API_KEY_SCOPE_DENIED');
  });

  it('is a no-op for interactive auth — the same route needs no scopes', async () => {
    app = await buildInteractiveApp();
    const { org, user } = await seedOrgWithAdmin();

    const res = await app.inject({
      method: 'GET',
      url: SCOPED_ROUTE,
      headers: {
        'x-test-user-id': user.id,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(200);
  });
});

describe('internalOnly — the boundary enforced since P0.5', () => {
  // Enforcement is the default since 2026-07-27. This pins the log-only
  // fallback that TRPC_INTERNAL_ONLY_ENFORCE=false still buys — the revert
  // path has to keep working, or the flag is not a lever.
  it('falls back to admitting an API key when explicitly set to false', async () => {
    setInternalOnlyEnforce(false);
    app = await buildApiKeyApp();
    const { org, user } = await seedOrgWithAdmin();
    const key = await insertApiKey({
      orgId: org.id,
      userId: user.id,
      scopes: ['submissions:read'],
    });

    const res = await app.inject({
      method: 'GET',
      url: `${INTERNAL_ROUTE}?input=${INTERNAL_INPUT}`,
      headers: {
        'x-api-key': key.plainKey,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(200);
    // Log-only mode still records the crossing.
    expect(await recentAuditActions(org.id)).toContain(
      'API_KEY_INTERNAL_ROUTE',
    );
  });

  it('rejects an API key with 403 once enforcement is on', async () => {
    setInternalOnlyEnforce(true);
    app = await buildApiKeyApp();
    const { org, user } = await seedOrgWithAdmin();
    const key = await insertApiKey({
      orgId: org.id,
      userId: user.id,
      scopes: ['submissions:read'],
    });

    const res = await app.inject({
      method: 'GET',
      url: `${INTERNAL_ROUTE}?input=${INTERNAL_INPUT}`,
      headers: {
        'x-api-key': key.plainKey,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('not available to API keys');
  });

  // The other cases here all set the flag explicitly, so none of them would
  // notice the schema default silently reverting to 'false'. This one pins the
  // deployed behaviour: unset must mean enforcing.
  it('enforces by default when the variable is not set at all', async () => {
    delete process.env.TRPC_INTERNAL_ONLY_ENFORCE;
    app = await buildApiKeyApp();
    const { org, user } = await seedOrgWithAdmin();
    const key = await insertApiKey({
      orgId: org.id,
      userId: user.id,
      scopes: ['submissions:read'],
    });

    const res = await app.inject({
      method: 'GET',
      url: `${INTERNAL_ROUTE}?input=${INTERNAL_INPUT}`,
      headers: {
        'x-api-key': key.plainKey,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('not available to API keys');
  });

  it('admits an interactive session under enforcement — this is what unblocks the E2E suites', async () => {
    setInternalOnlyEnforce(true);
    app = await buildInteractiveApp();
    const { org, user } = await seedOrgWithAdmin();

    const res = await app.inject({
      method: 'GET',
      url: `${INTERNAL_ROUTE}?input=${INTERNAL_INPUT}`,
      headers: {
        'x-test-user-id': user.id,
        'x-organization-id': org.id,
      },
    });

    expect(res.statusCode).toBe(200);
  });
});
