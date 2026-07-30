/**
 * Guard coverage across the hand-rolled Fastify surface.
 *
 * The third sibling of `rest/guard-coverage.spec.ts` and
 * `trpc/guard-coverage.spec.ts`. `X-Api-Key` is accepted on every non-public
 * route regardless of which surface serves it, and until 2026-07-29 not one
 * Fastify route declared a scope or an internal-only guard — `/federation/keys/*`
 * and `/federation/migrations*` had only a bare `if (!request.authContext)`
 * check, and the four admin modules gated on an ADMIN role that a key minted by
 * an admin satisfies. This is the check that stops the next one appearing.
 *
 * Two structural differences from the sibling gates:
 *
 *  1. There is no built router object to walk. Routes are collected by
 *     registering each module into a bare instance under a root `onRoute` hook,
 *     which fires for child plugin scopes too.
 *  2. A guard can be declared at route level (`preHandler`) or scope level
 *     (`guardScope`). Fastify's `onRoute` exposes only a route's own
 *     `preHandler`, so scope-level guards arrive via `config.guardTags`.
 *
 * **Why there is no "the guard actually rejects" test here.** That property is
 * proved by decomposition in `fastify-guards.spec.ts`: `guardScope` installs
 * exactly the functions it tags (and throws on an untagged one), and
 * `internalOnly` / `requireScopes` reject when installed. This suite asserts the
 * remaining link — that every non-public route declares something. Asserting
 * rejection here would mean mocking every service behind 30-odd routes to
 * exercise middleware that never reaches them.
 *
 * Introspection only — no handler is invoked and no service is mocked.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance, type RouteOptions } from 'fastify';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiKeyScopeSchema } from '@colophony/types';

import { validateEnv, type Env } from '../config/env.js';
import { isPublicRoute } from './auth.js';
import type { GuardTag } from '../services/scope-check.js';
import { readGuardTags } from '../services/scope-check.js';

import { registerEmbedRoutes } from '../routes/embed.routes.js';
import { registerPublicRoutes } from '../routes/public.routes.js';
import { registerNotificationStreamRoute } from '../sse/notification-stream.js';
import { registerInngestRoutes } from '../inngest/serve.js';
import { registerWebhookHealthRoute } from '../webhooks/webhook-health.route.js';
import { registerZitadelWebhooks } from '../webhooks/zitadel.webhook.js';
import { registerStripeWebhooks } from '../webhooks/stripe.webhook.js';
import { registerTusdWebhooks } from '../webhooks/tusd.webhook.js';
import { registerDocumensoWebhooks } from '../webhooks/documenso.webhook.js';
import { registerFederationDidRoutes } from '../federation/did.routes.js';
import { registerFederationDiscoveryRoutes } from '../federation/discovery.routes.js';
import { registerFederationTrustRoutes } from '../federation/trust.routes.js';
import { registerFederationTrustAdminRoutes } from '../federation/trust-admin.routes.js';
import { registerSimSubRoutes } from '../federation/simsub.routes.js';
import { registerSimSubAdminRoutes } from '../federation/simsub-admin.routes.js';
import { registerTransferRoutes } from '../federation/transfer.routes.js';
import { registerTransferAdminRoutes } from '../federation/transfer-admin.routes.js';
import { registerMigrationRoutes } from '../federation/migration.routes.js';
import { registerMigrationAdminRoutes } from '../federation/migration-admin.routes.js';
import { registerHubRoutes } from '../federation/hub.routes.js';
import { registerHubAdminRoutes } from '../federation/hub-admin.routes.js';
import { registerKeyAdminRoutes } from '../federation/key-admin.routes.js';

/**
 * Routes that deliberately declare no guard.
 *
 * Empty, and worth keeping that way. Every entry would be callable by any API key
 * holding any scope, so a reason must explain why the operation is safe
 * unconstrained — not merely why it currently lacks a guard. Public routes do not
 * belong here; they are exempted by `isPublicRoute` instead.
 */
const UNGUARDED_ROUTES: Record<string, string> = {};

const env: Env = validateEnv({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  FEDERATION_ENABLED: 'true',
  FEDERATION_DOMAIN: 'local.example.com',
  DEMO_MODE: 'true',
});

/**
 * Every module that registers routes directly on Fastify.
 *
 * `file` is the path relative to `apps/api/src`, and the parity test below checks
 * this list against the filesystem — a new route module that is not registered
 * here would otherwise be exempt from the whole gate without anyone noticing.
 */
const MODULES: Array<{
  file: string;
  register: (app: FastifyInstance) => Promise<void>;
}> = [
  {
    file: 'routes/embed.routes.ts',
    register: (app) => registerEmbedRoutes(app, { env }),
  },
  {
    file: 'routes/public.routes.ts',
    register: (app) => registerPublicRoutes(app, { env }),
  },
  {
    file: 'sse/notification-stream.ts',
    register: (app) => registerNotificationStreamRoute(app, { env }),
  },
  { file: 'inngest/serve.ts', register: (app) => registerInngestRoutes(app) },
  {
    file: 'webhooks/webhook-health.route.ts',
    register: (app) => registerWebhookHealthRoute(app, { env }),
  },
  {
    file: 'webhooks/zitadel.webhook.ts',
    register: (app) => registerZitadelWebhooks(app, { env }),
  },
  {
    file: 'webhooks/stripe.webhook.ts',
    register: (app) => registerStripeWebhooks(app, { env }),
  },
  {
    file: 'webhooks/tusd.webhook.ts',
    register: (app) => registerTusdWebhooks(app, { env }),
  },
  {
    file: 'webhooks/documenso.webhook.ts',
    register: (app) => registerDocumensoWebhooks(app, { env }),
  },
  {
    file: 'federation/did.routes.ts',
    register: (app) => registerFederationDidRoutes(app, { env }),
  },
  {
    file: 'federation/discovery.routes.ts',
    register: (app) => registerFederationDiscoveryRoutes(app, { env }),
  },
  {
    file: 'federation/trust.routes.ts',
    register: (app) => registerFederationTrustRoutes(app, { env }),
  },
  {
    file: 'federation/trust-admin.routes.ts',
    register: (app) => registerFederationTrustAdminRoutes(app, { env }),
  },
  {
    file: 'federation/simsub.routes.ts',
    register: (app) => registerSimSubRoutes(app, { env }),
  },
  {
    file: 'federation/simsub-admin.routes.ts',
    register: (app) => registerSimSubAdminRoutes(app, { env }),
  },
  {
    file: 'federation/transfer.routes.ts',
    register: (app) => registerTransferRoutes(app, { env }),
  },
  {
    file: 'federation/transfer-admin.routes.ts',
    register: (app) => registerTransferAdminRoutes(app, { env }),
  },
  {
    file: 'federation/migration.routes.ts',
    register: (app) => registerMigrationRoutes(app, { env }),
  },
  {
    file: 'federation/migration-admin.routes.ts',
    register: (app) => registerMigrationAdminRoutes(app, { env }),
  },
  {
    file: 'federation/hub.routes.ts',
    register: (app) => registerHubRoutes(app, { env }),
  },
  {
    file: 'federation/hub-admin.routes.ts',
    register: (app) => registerHubAdminRoutes(app, { env }),
  },
  {
    file: 'federation/key-admin.routes.ts',
    register: (app) => registerKeyAdminRoutes(app, { env }),
  },
];

/**
 * Routes registered inline in `main.ts` rather than in a module.
 *
 * All four are in the auth hook's public allowlist, so they would be exempt
 * anyway; they are listed so the parity test's accounting is complete and a
 * future non-public inline route is a visible omission rather than an invisible
 * one.
 */
const MAIN_TS_INLINE_ROUTES = ['/health', '/ready', '/', '/metrics'];

interface RouteEntry {
  method: string;
  url: string;
  guards: GuardTag[];
  label: string;
}

/**
 * One bare instance per module, rather than one shared instance.
 *
 * Several modules register `@fastify/cors` themselves, and two of them on one
 * instance collide on `OPTIONS *` with `FST_ERR_DUPLICATED_ROUTE`. Separate
 * instances also mean a scope-level hook from one module provably cannot be
 * counted toward another's routes — the isolation is structural rather than
 * something this file has to be careful about.
 */
async function collectRoutes(): Promise<RouteEntry[]> {
  const collected: RouteEntry[] = [];

  for (const mod of MODULES) {
    const app = Fastify({ logger: false });
    const seen: RouteOptions[] = [];

    // Capture the routeOptions object and read its guards only after ready().
    //
    // Reading `config` inside this hook would find it empty: Fastify runs
    // onRoute hooks in registration order, this one is registered before the
    // module, and `guardScope`'s own onRoute hook is what writes `config`. So
    // the reference is captured now and dereferenced later — `guardScope`
    // mutates this same object.
    app.addHook('onRoute', (routeOptions: RouteOptions) => {
      seen.push(routeOptions);
    });

    // Some modules expect the decorators the real hook chain provides.
    app.decorateRequest('authContext', null);

    try {
      await mod.register(app);
      await app.ready();
    } catch (error) {
      throw new Error(
        `Failed to register ${mod.file} for guard coverage: ${String(error)}`,
        { cause: error },
      );
    } finally {
      await app.close();
    }

    for (const routeOptions of seen) {
      const methods = Array.isArray(routeOptions.method)
        ? routeOptions.method
        : [routeOptions.method];

      const routeLevel = Array.isArray(routeOptions.preHandler)
        ? routeOptions.preHandler
        : routeOptions.preHandler
          ? [routeOptions.preHandler]
          : [];

      const guards = [
        ...(routeOptions.config?.guardTags ?? []),
        ...readGuardTags(routeLevel),
      ];

      for (const method of methods) {
        collected.push({
          method,
          url: routeOptions.url,
          guards,
          label: `${method} ${routeOptions.url}`,
        });
      }
    }
  }

  return collected.filter(
    (route) =>
      // Synthesised by Fastify from GET; inherits its guards.
      route.method !== 'HEAD' &&
      // The `OPTIONS *` wildcard is @fastify/cors's preflight responder, not an
      // API operation: it carries no credentials, reads nothing, and returns
      // only CORS headers. Registered by whichever modules enable cors.
      !(route.method === 'OPTIONS' && route.url === '*'),
  );
}

/**
 * Locate `apps/api/src` without `import.meta`, which `tsc --noEmit` rejects for
 * this package's CommonJS-targeted config. Handles being run with the cwd at
 * either `apps/api` (vitest's default root) or the repo root.
 */
function resolveSrcDir(): string {
  const candidates = [
    join(process.cwd(), 'src'),
    join(process.cwd(), 'apps', 'api', 'src'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'hooks'))) return candidate;
  }

  throw new Error(
    `Could not locate apps/api/src from cwd ${process.cwd()} — tried:\n` +
      candidates.map((c) => `  - ${c}`).join('\n'),
  );
}

let routes: RouteEntry[];
let guardable: RouteEntry[];

describe('Fastify guard coverage', () => {
  beforeAll(async () => {
    routes = await collectRoutes();
    guardable = routes.filter((route) => !isPublicRoute(route.url));
  });

  it('collects a plausible number of routes', () => {
    // Guards against the whole suite passing vacuously because a Fastify change
    // stopped `onRoute` firing, or because a registration silently no-oped.
    // 60 routes across 22 modules today.
    expect(routes.length).toBeGreaterThan(45);
  });

  it('finds routes that actually need a guard', () => {
    // The companion canary: if `isPublicRoute` ever matched everything, the
    // coverage assertion below would iterate an empty list and pass.
    expect(guardable.length).toBeGreaterThan(20);
  });

  it('registers every hand-rolled route module', () => {
    // A new module that nobody adds to MODULES is exempt from this entire gate.
    // Globbing the filesystem is what makes that a failure rather than a gap.
    const srcDir = resolveSrcDir();

    const discovered = ['routes', 'federation', 'webhooks', 'sse', 'inngest']
      .flatMap((dir) =>
        readdirSync(join(srcDir, dir)).map((name) => `${dir}/${name}`),
      )
      .filter(
        (file) =>
          (file.endsWith('.routes.ts') ||
            file.endsWith('.webhook.ts') ||
            file.endsWith('.route.ts') ||
            file.endsWith('serve.ts') ||
            file.endsWith('notification-stream.ts')) &&
          !file.endsWith('.spec.ts') &&
          !file.endsWith('.test.ts'),
      );

    const registered = new Set(MODULES.map((m) => m.file));
    const missing = discovered.filter((file) => !registered.has(file)).sort();

    expect(
      missing,
      missing.length === 0
        ? ''
        : `These route modules are not registered in MODULES, so no guard ` +
            `assertion in this file applies to them:\n\n` +
            missing.map((f) => `  - ${f}`).join('\n') +
            `\n\nAdd each to MODULES. If a file genuinely registers no route, ` +
            `it should not match the route-module naming conventions.`,
    ).toEqual([]);
  });

  it('every non-public route declares a guard', () => {
    const offenders = guardable
      .filter((route) => route.guards.length === 0)
      .filter((route) => !(route.label in UNGUARDED_ROUTES))
      .map((route) => route.label)
      .sort();

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `These Fastify routes declare no guard, so any API key with any ` +
            `scope can call them:\n\n` +
            offenders.map((r) => `  - ${r}`).join('\n') +
            `\n\nAdd a route-level preHandler: [requireScopes('<scope>')], or ` +
            `guardScope(app, internalOnly) at the top of the module if the ` +
            `operation belongs to interactive sessions only. If the operation ` +
            `genuinely needs no guard, add it to UNGUARDED_ROUTES with a reason.`,
    ).toEqual([]);
  });

  it('no route declares an empty scope list', () => {
    // requireScopes() with no arguments passes [] to checkApiKeyScopes, whose
    // `missing.length === 0` check then allows everything. A vacuous guard reads
    // exactly like a real one at the call site.
    const vacuous = routes
      .filter((route) =>
        route.guards.some(
          (guard) => guard.kind === 'scopes' && guard.scopes.length === 0,
        ),
      )
      .map((route) => route.label)
      .sort();

    expect(vacuous).toEqual([]);
  });

  it('scope guards name only scopes defined in apiKeyScopeSchema', () => {
    // A typo'd scope denies silently and permanently — no key can ever hold a
    // scope that is not in the enum.
    const unknown = routes
      .flatMap((route) =>
        route.guards
          .filter((guard) => guard.kind === 'scopes')
          .flatMap((guard) => guard.scopes)
          .filter((scope) => !apiKeyScopeSchema.safeParse(scope).success)
          .map((scope) => `${route.label} -> ${scope}`),
      )
      .sort();

    expect(unknown).toEqual([]);
  });

  it('every UNGUARDED_ROUTES entry still exists and is still unguarded', () => {
    // Reverse staleness: an allowlist entry that has since been guarded, or
    // deleted, should be removed rather than left implying an exemption is
    // still in force.
    const byLabel = new Map(routes.map((route) => [route.label, route]));

    const stale = Object.keys(UNGUARDED_ROUTES)
      .map((label) => {
        const route = byLabel.get(label);
        if (!route) return `${label} (no longer exists — remove this entry)`;
        if (route.guards.length > 0)
          return `${label} (now declares a guard — remove this entry)`;
        return null;
      })
      .filter((problem): problem is string => problem !== null)
      .sort();

    expect(stale).toEqual([]);
  });

  it('the inline main.ts routes are all public', () => {
    // These are not in MODULES, so nothing above covers them. If one ever stops
    // being public it needs a guard and a home in a real module.
    const nonPublic = MAIN_TS_INLINE_ROUTES.filter(
      (url) => !isPublicRoute(url),
    ).sort();

    expect(nonPublic).toEqual([]);
  });
});
