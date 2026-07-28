import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../../../config/env.js';
import authPlugin from '../../../hooks/auth.js';
import orgContextPlugin from '../../../hooks/org-context.js';
import dbContextPlugin from '../../../hooks/db-context.js';
import auditPlugin from '../../../hooks/audit.js';
import { appRouter } from '../../../trpc/router.js';
import { createContext } from '../../../trpc/context.js';
import { createTestEnv } from '../../webhooks/helpers/webhook-app.js';
import { getAdminPool } from '../../rls/helpers/db-setup.js';

/**
 * Build a Fastify instance with the real auth chain and the real tRPC router.
 *
 * Mirrors main.ts's hook order (auth -> orgContext -> dbContext -> audit) but
 * omits rate limiting, queues, and the REST/SSE surfaces so the suite needs no
 * Redis. The point is to exercise `requireScopes` and `internalOnly` against a
 * genuine `api_keys` row and the real `verify_api_key()` lookup, rather than a
 * hand-built AuthContext.
 *
 * Prefer the two named builders below — the auth mode is not a free parameter.
 */
async function buildAuthApp(envOverrides?: Partial<Env>) {
  const env: Env = createTestEnv(envOverrides);

  const app = Fastify({ logger: false, maxParamLength: 500 });

  await app.register(authPlugin, { env });
  await app.register(orgContextPlugin);
  await app.register(dbContextPlugin);
  await app.register(auditPlugin);

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });

  await app.ready();
  return app;
}

/**
 * An app that can authenticate API keys.
 *
 * Must NOT be NODE_ENV=test. When `isTest && !verifyToken`, hooks/auth.ts takes
 * the test-header branch and returns early — either honouring `x-test-user-id`
 * or 401ing — so the `X-Api-Key` branch below it is unreachable. The two auth
 * modes are mutually exclusive by construction, which is also why the E2E
 * suites stopped being able to use keys once the gate was opened.
 */
export function buildApiKeyApp(
  envOverrides?: Partial<Env>,
): Promise<FastifyInstance> {
  return buildAuthApp({
    NODE_ENV: 'development',
    ZITADEL_AUTHORITY: undefined,
    DEV_AUTH_BYPASS: false,
    ...envOverrides,
  });
}

/**
 * An app that accepts the interactive test headers — the mode Playwright runs
 * against. Requires NODE_ENV=test and no JWKS verifier.
 */
export function buildInteractiveApp(
  envOverrides?: Partial<Env>,
): Promise<FastifyInstance> {
  return buildAuthApp({
    NODE_ENV: 'test',
    ZITADEL_AUTHORITY: undefined,
    ...envOverrides,
  });
}

/**
 * Insert a real API key row and return the plaintext key.
 *
 * Written through the admin pool because `api_keys` is RLS-protected and the
 * caller has no org context yet. The hash must match api-key.service's
 * `hashKey` (plain sha256 hex) or `verify_api_key()` will not find the row.
 */
export async function insertApiKey(params: {
  orgId: string;
  userId: string;
  scopes: string[];
  name?: string;
}): Promise<{ id: string; plainKey: string }> {
  const plainKey = `col_test_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(plainKey).digest('hex');

  const result = await getAdminPool().query<{ id: string }>(
    `INSERT INTO api_keys
       (organization_id, created_by, name, key_hash, key_prefix, scopes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      params.orgId,
      params.userId,
      params.name ?? `scope-enforcement-${Date.now()}`,
      keyHash,
      plainKey.slice(0, 12),
      JSON.stringify(params.scopes),
    ],
  );

  return { id: result.rows[0].id, plainKey };
}

/** Read audit actions written for an org, most recent first. */
export async function recentAuditActions(orgId: string): Promise<string[]> {
  const result = await getAdminPool().query<{ action: string }>(
    `SELECT action FROM audit_events
      WHERE organization_id = $1 OR organization_id IS NULL
      ORDER BY created_at DESC
      LIMIT 20`,
    [orgId],
  );
  return result.rows.map((r) => r.action);
}
