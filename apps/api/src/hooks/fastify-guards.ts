/**
 * API key guards for hand-rolled Fastify routes.
 *
 * The third of three guard surfaces. oRPC declares scopes with
 * `rest/context.ts`'s `requireScopes`; tRPC declares scopes or `internalOnly`
 * with `trpc/init.ts`'s equivalents. Fastify routes declared neither until
 * 2026-07-29, so every one of them was reachable by any valid API key holding any
 * scope — `X-Api-Key` is accepted on every non-public route regardless of which
 * surface serves it.
 *
 * Both guards here are tagged with `markGuard` so
 * `fastify-guard-coverage.spec.ts` can see them on a registered route. **A new
 * guard on this surface must be tagged the same way or the gate will read the
 * route as unguarded.**
 *
 * Two behaviours are load-bearing and easy to undo by accident:
 *
 *  1. **Deny by replying, never by throwing.** Fastify 5 requires
 *     `return reply.status(N).send(...)` from a preHandler; and the audit-then-deny
 *     pattern borrowed from tRPC only persists its row because the denial is a
 *     normal reply, so `db-context`'s `onResponse` COMMIT fires rather than its
 *     `onError` ROLLBACK. A guard that threw would roll back its own audit row.
 *  2. **`request.audit` is a no-op without a transaction.** `db-context.ts` skips
 *     the per-request transaction for `/api/notifications/stream` (a hijacked
 *     reply means `onResponse` never fires), and `audit.ts` therefore swaps
 *     `request.audit` for a warn-only stub. `auditDenial` below routes around
 *     that with `withRls`, the same convention the SSE handler itself uses.
 */
import type {
  FastifyInstance,
  FastifyRequest,
  preHandlerAsyncHookHandler,
  RouteOptions,
} from 'fastify';
import { withRls } from '@colophony/db';
import type { ApiKeyScope, AuditLogParams } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import {
  checkApiKeyScopes,
  markGuard,
  readGuardTags,
  INTERACTIVE_AUTH_METHODS,
  type GuardTag,
} from '../services/scope-check.js';
import {
  auditService,
  principalFromAuthContext,
} from '../services/audit.service.js';
import { validateEnv } from '../config/env.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Guard tags contributed by `guardScope`, for routes whose guard is a
     * plugin-scope hook rather than a route-level `preHandler`. Fastify's
     * `onRoute` exposes only a route's own `preHandler`, so a scope-level guard
     * is otherwise invisible to the coverage gate.
     */
    guardTags?: GuardTag[];
  }
}

/** Audit params minus the fields this module derives from the request. */
type DenialParams = Omit<
  Extract<AuditLogParams, { resource: typeof AuditResources.API_KEY }>,
  | 'actorId'
  | 'organizationId'
  | 'ipAddress'
  | 'userAgent'
  | 'requestId'
  | 'method'
  | 'route'
  | 'principalId'
  | 'principalType'
>;

/**
 * Write a denial audit row, with or without a per-request transaction.
 *
 * `request.audit` is used when `dbTx` exists — it already derives actor, org, IP,
 * user agent, request id, method and route. Without one (the SSE route) it is a
 * warn-only stub, so fall back to `withRls` and supply those fields here so rows
 * from either path are indistinguishable.
 *
 * A denial with no org context cannot be written at all: `audit_events` is
 * org-scoped by RLS and `auditService.logDirect` explicitly refuses an
 * `organizationId`. That combination is unreachable on the scope path — scopes
 * apply only to `apikey` auth and `hooks/auth.ts` pre-sets `orgId` from the key's
 * `organizationId` — but warn rather than throw if it ever happens, because
 * throwing here would turn a 403 into a 500.
 */
async function auditDenial(
  request: FastifyRequest,
  params: DenialParams,
): Promise<void> {
  if (request.dbTx) {
    await request.audit(params);
    return;
  }

  const auth = request.authContext;
  const orgId = auth?.orgId;

  if (!orgId || !auth) {
    request.log.warn(
      { action: params.action },
      'guard denial not audited: no transaction and no org context',
    );
    return;
  }

  try {
    await withRls({ orgId, userId: auth.userId }, async (tx) => {
      await auditService.log(tx, {
        ...params,
        actorId: auth.userId,
        organizationId: orgId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: String(request.id),
        method: request.method,
        route: routeLabel(request),
        ...principalFromAuthContext(auth),
      });
    });
  } catch (error) {
    // The denial itself must still reach the caller. An audit write that fails
    // is a monitoring problem; a 500 in its place is an availability one.
    request.log.error(
      { err: error, action: params.action },
      'failed to write guard denial audit row',
    );
  }
}

/** The route pattern, not the concrete URL — `/x/:id`, not `/x/<uuid>`. */
function routeLabel(request: FastifyRequest): string {
  return request.routeOptions?.url ?? request.url.split('?')[0];
}

/**
 * Factory: returns a Fastify preHandler that enforces API key scopes.
 *
 * OIDC/demo/test auth bypasses the check — scopes are API-key-only, so adding a
 * guard to a route cannot break the interactive web app or Playwright E2E.
 */
export function requireScopes(
  ...scopes: ApiKeyScope[]
): preHandlerAsyncHookHandler {
  const guard: preHandlerAsyncHookHandler = async function requireScopesGuard(
    request,
    reply,
  ) {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const result = checkApiKeyScopes(request.authContext, scopes);
    if (!result.allowed) {
      await auditDenial(request, {
        action: AuditActions.API_KEY_SCOPE_DENIED,
        resource: AuditResources.API_KEY,
        resourceId: request.authContext.apiKeyId,
        newValue: { required: scopes, missing: result.missing },
      });

      return reply.status(403).send({
        error: 'insufficient_scope',
        message: 'Insufficient API key scope',
        required: scopes,
        missing: result.missing,
      });
    }
  };

  return markGuard(guard, { kind: 'scopes', scopes });
}

/**
 * Restricts a route to interactive human sessions.
 *
 * Mirrors `trpc/init.ts`'s `internalOnly`, including the allowlist semantics:
 * `INTERACTIVE_AUTH_METHODS` is shared between the two so a future credential
 * class is excluded from both by construction.
 *
 * Enforcing by default. `INTERNAL_ONLY_ENFORCE=false` reverts to log-only,
 * auditing the crossing and letting it through — the revert lever, not a normal
 * setting. An unauthenticated caller is rejected in both modes, unaudited.
 */
export const internalOnly: preHandlerAsyncHookHandler = markGuard(
  async function internalOnlyGuard(request, reply) {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    if (INTERACTIVE_AUTH_METHODS.includes(request.authContext.authMethod)) {
      return;
    }

    // validateEnv() is called here rather than at module level — a module-level
    // call breaks test imports.
    const enforced = validateEnv().INTERNAL_ONLY_ENFORCE;

    await auditDenial(request, {
      action: AuditActions.API_KEY_INTERNAL_ROUTE,
      resource: AuditResources.API_KEY,
      resourceId: request.authContext.apiKeyId,
      newValue: {
        route: routeLabel(request),
        authMethod: request.authContext.authMethod,
        enforced,
      },
    });

    if (enforced) {
      return reply.status(403).send({
        error: 'forbidden',
        message: 'This route is not available to API keys',
      });
    }
  },
  { kind: 'internal' },
);

/**
 * Install guards on every route in a plugin scope, and declare them where the
 * coverage gate can see them.
 *
 * Needed because `onRoute` exposes only a route's own `preHandler`, so a guard
 * added with `app.addHook('preHandler', ...)` is invisible to the gate. It also
 * gets the ordering right: scope-level preHandlers run before route-level ones,
 * so calling this **above** an existing role check makes a key's refusal read
 * "not available to API keys" rather than "ADMIN role required" — the audit trail
 * should say why the call was actually refused. `trpc/init.ts` orders
 * `internalOnly` first for the same reason.
 *
 * Declaration cannot drift from enforcement: the tags come from the same function
 * objects installed as hooks.
 */
export function guardScope(
  app: FastifyInstance,
  ...guards: preHandlerAsyncHookHandler[]
): void {
  const tags = readGuardTags(guards);

  /* c8 ignore next 5 -- defensive: every guard in this module is tagged */
  if (tags.length !== guards.length) {
    throw new Error(
      'guardScope received an untagged guard — wrap it with markGuard() or the ' +
        'coverage gate will read every route in this scope as unguarded',
    );
  }

  for (const guard of guards) {
    app.addHook('preHandler', guard);
  }

  app.addHook('onRoute', (routeOptions: RouteOptions) => {
    // Fastify runs onRoute hooks before it builds the final config object, and
    // every route here uses the `app.get(path, handler)` shorthand, so `config`
    // is undefined at this point.
    routeOptions.config = {
      ...routeOptions.config,
      guardTags: [...(routeOptions.config?.guardTags ?? []), ...tags],
    };
  });
}
