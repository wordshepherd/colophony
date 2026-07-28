/**
 * Guard coverage across the whole tRPC surface.
 *
 * `X-Api-Key` is accepted on every non-public route, `/trpc/*` included — tRPC
 * is internal by intent, not by mechanism. A procedure is therefore only out of
 * an API key's reach if it declares one of two things: a `requireScopes(...)`
 * guard, or an `internal*Procedure` builder. A procedure declaring neither is
 * callable by any valid key holding any scope.
 *
 * P0.1/P0.1b closed the ten routers that had no guard. This suite is what stops
 * the eleventh appearing: it reads every procedure's middleware chain out of the
 * built `appRouter` and fails on one that declares neither.
 *
 * DECLARES, not "is protected" — the distinction was load-bearing while the
 * two guards differed. A `requireScopes` declaration is also its enforcement;
 * `internalOnly` only declared, and audited the crossing, until P0.5 flipped
 * `TRPC_INTERNAL_ONLY_ENFORCE` to true on 2026-07-27. Both now enforce on
 * declaration. The last test pins that, so a revert to log-only cannot pass
 * silently.
 *
 * Introspection only — no service is mocked because tests 1-5 never invoke a
 * procedure, and test 6 rejects at middleware index 0, before any service is
 * reached.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiKeyScopeSchema } from '@colophony/types';

const { envState } = vi.hoisted(() => ({
  envState: { TRPC_INTERNAL_ONLY_ENFORCE: false },
}));

vi.mock('../config/env.js', () => ({
  validateEnv: () => envState,
}));

import { appRouter } from './router.js';
import { readGuardTags, type GuardTag } from './init.js';
import type { TRPCContext } from './context.js';

/**
 * Procedures that deliberately declare neither guard.
 *
 * Every entry here is callable by any API key holding any scope. Nothing that
 * reads or writes tenant data belongs in this list — the reason must explain
 * why the procedure is safe without a guard, not merely why it lacks one.
 */
const UNGUARDED_PROCEDURES: Record<string, string> = {
  health:
    'Liveness probe. Takes no input, touches no database, and returns a ' +
    'constant. Allowlisted in the auth hook, so it is reachable without any ' +
    'credential at all — a scope guard would be decorative.',
};

/** Router keys in `appRouter` whose procedures are all internal-only. */
const INTERNAL_ROUTERS = [
  'federation',
  'gdpr',
  'hub',
  'migrations',
  'ops',
  'simsub',
  'transfers',
] as const;

interface BuiltProcedure {
  _def: { middlewares?: readonly unknown[] };
}

interface ProcedureEntry {
  path: string;
  guards: GuardTag[];
}

function allProcedures(): ProcedureEntry[] {
  const procedures = appRouter._def.procedures as unknown as Record<
    string,
    BuiltProcedure
  >;

  return Object.entries(procedures).map(([path, procedure]) => ({
    path,
    guards: readGuardTags(procedure._def.middlewares ?? []),
  }));
}

function isUnguarded(entry: ProcedureEntry): boolean {
  return entry.guards.length === 0;
}

describe('tRPC guard coverage (P0.4)', () => {
  beforeEach(() => {
    envState.TRPC_INTERNAL_ONLY_ENFORCE = false;
  });

  it('introspects a plausible number of procedures', () => {
    // Guards against the whole suite silently passing because the shape of
    // `_def.procedures` changed under a tRPC upgrade and every assertion below
    // started iterating an empty list.
    expect(allProcedures().length).toBeGreaterThan(250);
  });

  it('every procedure declares a scope guard or the internal guard', () => {
    const offenders = allProcedures()
      .filter(isUnguarded)
      .map((entry) => entry.path)
      .filter((path) => !(path in UNGUARDED_PROCEDURES))
      .sort();

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `These tRPC procedures declare neither guard, so any API key with ` +
            `any scope can call them:\n\n` +
            offenders.map((p) => `  - ${p}`).join('\n') +
            `\n\nAdd .use(requireScopes('<scope>')) if the procedure is meant ` +
            `to have a REST equivalent, or build it from ` +
            `internalAdminProcedure / internalAuthedProcedure if it is ` +
            `operator-console only. If it genuinely needs neither, add it to ` +
            `UNGUARDED_PROCEDURES with a reason.`,
    ).toEqual([]);
  });

  it('no procedure declares an empty scope list', () => {
    // requireScopes() with no arguments passes [] to checkApiKeyScopes, whose
    // `missing.length === 0` check then allows everything. A vacuous guard
    // reads exactly like a real one at the call site.
    const vacuous = allProcedures()
      .filter((entry) =>
        entry.guards.some(
          (guard) => guard.kind === 'scopes' && guard.scopes.length === 0,
        ),
      )
      .map((entry) => entry.path)
      .sort();

    expect(vacuous).toEqual([]);
  });

  it('scope guards name only scopes defined in apiKeyScopeSchema', () => {
    // A typo'd scope string denies silently and permanently — no key can ever
    // hold a scope that is not in the enum.
    const unknown = allProcedures()
      .flatMap((entry) =>
        entry.guards
          .filter((guard) => guard.kind === 'scopes')
          .flatMap((guard) => guard.scopes)
          .filter((scope) => !apiKeyScopeSchema.safeParse(scope).success)
          .map((scope) => `${entry.path} -> ${scope}`),
      )
      .sort();

    expect(unknown).toEqual([]);
  });

  it('every UNGUARDED_PROCEDURES entry still exists and is still unguarded', () => {
    const byPath = new Map(
      allProcedures().map((entry) => [entry.path, entry] as const),
    );

    const stale = Object.keys(UNGUARDED_PROCEDURES)
      .map((path) => {
        const entry = byPath.get(path);
        if (!entry) return `${path} (no longer exists — remove this entry)`;
        if (!isUnguarded(entry))
          return `${path} (now declares a guard — remove this entry)`;
        return null;
      })
      .filter((problem): problem is string => problem !== null)
      .sort();

    expect(stale).toEqual([]);
  });

  it('the seven internal routers declare the internal guard throughout', () => {
    const downgraded = allProcedures()
      .filter((entry) =>
        INTERNAL_ROUTERS.some((router) => entry.path.startsWith(`${router}.`)),
      )
      .filter((entry) => !entry.guards.some((g) => g.kind === 'internal'))
      .map((entry) => entry.path)
      .sort();

    expect(downgraded).toEqual([]);
  });

  it('every internal-guarded procedure denies an API key once enforcement is on', async () => {
    // The behavioural counterpart to the declaration checks above: proves the
    // boundary actually rejects, for all internal procedures rather than the
    // single one scope-enforcement.spec.ts covers.
    envState.TRPC_INTERNAL_ONLY_ENFORCE = true;

    const context: TRPCContext = {
      authContext: {
        userId: '00000000-0000-4000-a000-000000000001',
        email: 'key@example.com',
        emailVerified: true,
        authMethod: 'apikey',
        apiKeyId: '00000000-0000-4000-a000-0000000000ff',
        apiKeyScopes: ['manuscripts:read'],
        orgId: '00000000-0000-4000-a000-000000000010',
        roles: ['ADMIN'],
      },
      dbTx: {} as TRPCContext['dbTx'],
      audit: vi.fn(),
    } as unknown as TRPCContext;

    const caller = (
      appRouter as unknown as {
        createCaller: (ctx: TRPCContext) => Record<string, unknown>;
      }
    ).createCaller(context);

    const internalPaths = allProcedures()
      .filter((entry) => entry.guards.some((g) => g.kind === 'internal'))
      .map((entry) => entry.path);

    expect(internalPaths.length).toBeGreaterThan(0);

    const admitted: string[] = [];

    for (const path of internalPaths) {
      const invoke = path
        .split('.')
        .reduce<unknown>(
          (node, segment) => (node as Record<string, unknown>)[segment],
          caller,
        ) as (input?: unknown) => Promise<unknown>;

      // internalOnly sits at middleware index 0 on both internal builders, so
      // it throws before the role check and before input is parsed — undefined
      // input is fine, and no service is reached.
      const outcome = await invoke(undefined).then(
        () => 'resolved' as const,
        (error: unknown) => error,
      );

      const denied =
        outcome !== 'resolved' &&
        (outcome as { code?: string })?.code === 'FORBIDDEN';

      if (!denied) admitted.push(path);
    }

    expect(
      admitted,
      admitted.length === 0
        ? ''
        : `These procedures declare internalOnly but did not reject an API ` +
            `key under TRPC_INTERNAL_ONLY_ENFORCE=true:\n` +
            admitted.map((p) => `  - ${p}`).join('\n'),
    ).toEqual([]);
  });
});
