/**
 * Guard coverage across the whole REST surface.
 *
 * The mirror of `trpc/guard-coverage.spec.ts`, and it exists for the reason that
 * suite's absence on this side allowed: `POST /v1/invitations/accept` shipped as a
 * bare `userProcedure` while its tRPC twin declared `organizations:write`. That
 * was the second REST/tRPC scope-parity gap found in two sessions, and both were
 * found by audit rather than by CI. This is the check that makes the third fail
 * the build instead.
 *
 * A REST procedure is only constrained if it declares `requireScopes(...)`.
 * Authentication alone is not enough — `userProcedure` proves a caller is
 * someone, not that their credential was granted this operation.
 *
 * Two structural differences from the tRPC gate:
 *
 *  1. `restRouter` is a nested plain object, not a flat `_def.procedures` map, so
 *     this walks it recursively with oRPC's own `isProcedure` as the leaf test.
 *  2. There is no `internalOnly` and no `publicProcedure` on this surface, so
 *     there is exactly one guard kind to look for and no internal-router pin.
 *
 * Introspection only — no procedure is invoked and no service is mocked.
 */
import { describe, it, expect } from 'vitest';
import { isProcedure } from '@orpc/server';
import { apiKeyScopeSchema } from '@colophony/types';

import { restRouter } from './openapi-spec.js';
import { readGuardTags, type GuardTag } from '../services/scope-check.js';

/**
 * Procedures that deliberately declare no scope guard.
 *
 * Empty, and worth keeping that way. Every entry would be callable by any API key
 * holding any scope, so a reason must explain why the operation is safe
 * unconstrained — not merely why it currently lacks a guard. The tRPC gate's one
 * entry is a credential-free liveness probe; this surface has no analogue.
 */
const UNGUARDED_PROCEDURES: Record<string, string> = {};

/**
 * The internal shape oRPC exposes. `'~orpc'` is deliberately marked internal by
 * the library: it is typed and stable across 1.14.x, but the count canary below
 * is what catches a rename on upgrade.
 */
interface BuiltProcedure {
  '~orpc': {
    middlewares?: readonly unknown[];
    route?: { method?: string; path?: string; operationId?: string };
  };
}

interface ProcedureEntry {
  path: string;
  guards: GuardTag[];
  label: string;
}

function describeRoute(procedure: BuiltProcedure, path: string): string {
  const route = procedure['~orpc'].route;
  if (!route?.method || !route.path) return path;
  const operation = route.operationId ? ` (${route.operationId})` : '';
  return `${route.method} ${route.path}${operation}`;
}

function collect(
  node: unknown,
  prefix: string,
  acc: ProcedureEntry[],
): ProcedureEntry[] {
  if (isProcedure(node)) {
    const procedure = node as unknown as BuiltProcedure;
    acc.push({
      path: prefix,
      guards: readGuardTags(procedure['~orpc'].middlewares ?? []),
      label: describeRoute(procedure, prefix),
    });
    return acc;
  }

  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      collect(child, prefix ? `${prefix}.${key}` : key, acc);
    }
  }

  return acc;
}

function allProcedures(): ProcedureEntry[] {
  return collect(restRouter, '', []);
}

describe('REST guard coverage', () => {
  it('introspects a plausible number of procedures', () => {
    // Guards against the whole suite silently passing because `'~orpc'` was
    // renamed under an @orpc/server upgrade and every assertion below started
    // iterating an empty list. 146 operations today.
    expect(allProcedures().length).toBeGreaterThan(130);
  });

  it('every procedure declares a scope guard', () => {
    const offenders = allProcedures()
      .filter((entry) => entry.guards.length === 0)
      .filter((entry) => !(entry.path in UNGUARDED_PROCEDURES))
      .map((entry) => entry.label)
      .sort();

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `These REST procedures declare no scope guard, so any API key with ` +
            `any scope can call them:\n\n` +
            offenders.map((p) => `  - ${p}`).join('\n') +
            `\n\nAdd .use(requireScopes('<scope>')) between the procedure ` +
            `builder and .route(). If the operation has a tRPC twin, declare ` +
            `the same scope it does. If it genuinely needs no guard, add it to ` +
            `UNGUARDED_PROCEDURES with a reason.`,
    ).toEqual([]);
  });

  it('no procedure declares an empty scope list', () => {
    // requireScopes() with no arguments passes [] to checkApiKeyScopes, whose
    // `missing.length === 0` check then allows everything. A vacuous guard reads
    // exactly like a real one at the call site.
    const vacuous = allProcedures()
      .filter((entry) =>
        entry.guards.some(
          (guard) => guard.kind === 'scopes' && guard.scopes.length === 0,
        ),
      )
      .map((entry) => entry.label)
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
          .map((scope) => `${entry.label} -> ${scope}`),
      )
      .sort();

    expect(unknown).toEqual([]);
  });

  it('every UNGUARDED_PROCEDURES entry still exists and is still unguarded', () => {
    // Reverse staleness: an allowlist entry that has since been guarded, or
    // deleted, should be removed rather than left implying an exemption is
    // still in force.
    const byPath = new Map(
      allProcedures().map((entry) => [entry.path, entry] as const),
    );

    const stale = Object.keys(UNGUARDED_PROCEDURES)
      .filter((path) => {
        const entry = byPath.get(path);
        return entry === undefined || entry.guards.length > 0;
      })
      .sort();

    expect(stale).toEqual([]);
  });
});
