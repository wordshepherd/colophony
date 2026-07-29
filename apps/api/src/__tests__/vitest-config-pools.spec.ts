/**
 * Config-level gate: no integration suite may collapse the two database pools.
 *
 * `packages/db/src/client.ts` reads `DATABASE_URL` for the superuser pool
 * (`db`/`pool`) and `DATABASE_APP_URL` for the `app_user` pool (`appPool`,
 * behind `withRls()`). Deriving one from the other in a vitest config makes them
 * the same connection, which silently demotes every code path that reaches for
 * the superuser pool precisely in order to bypass RLS. That shipped in
 * `vitest.config.integration-base.ts` and was rediscovered three times before
 * being fixed at the source.
 *
 * Runtime enforcement lives in `helpers/assert-pool-separation.ts` (string
 * inequality, every file) and `rls/helpers/db-setup.ts` (role identity, via
 * `globalSetup`). Both only run when an integration suite executes, and CI path
 * filtering means a PR can skip those suites entirely. This spec runs in the
 * unit suite, which always runs.
 *
 * Needs no database, so it belongs in the unit suite — and lands there: the
 * include pattern in `vitest.config.ts` covers every `.test.ts` and `.spec.ts`
 * under `src`, and its exclude list names only the five specialized child
 * directories, so a `.spec.ts` directly under `src/__tests__/` is collected.
 * (Contrast the note in `security/unprotected-table-callsites.test.ts`, where a
 * `.spec.ts` inside one of those excluded directories would be collected by no
 * suite at all.)
 *
 * **It resolves each config and compares the values, rather than pattern-matching
 * the source.** The first version of this gate matched the one source spelling
 * the original defect happened to use, and a branch review pointed out how little
 * that proves: an intermediate `const`, `||` in place of `??`, or a quoted
 * property key all collapse the pools while sailing past the regex. Comparing
 * resolved values has no such gap — whatever expression produced the two strings,
 * this sees the strings.
 *
 * The import is deliberately a computed path rather than a literal. A static
 * `import` of these files fails `tsc` with TS6059, because the configs sit beside
 * `src/` and `rootDir` is `src` (relaxing `rootDir` is not an option — the build
 * config extends this one, so it would change `dist/` layout). `tsc` does not
 * resolve a dynamic import whose specifier is a variable, and vite transforms the
 * TS on the way in. The path is built from `__dirname`, so it does not depend on
 * the process CWD. If vitest ever stops resolving it, the import throws and this
 * spec fails loudly — it cannot degrade into passing vacuously.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// `__dirname`, not `import.meta` — this package type-checks against a CommonJS
// target, which rejects `import.meta` outright (TS1470). Matches
// `rls/helpers/db-setup.ts` and `security/unprotected-table-callsites.test.ts`.
const API_ROOT = path.resolve(__dirname, '../..');

/**
 * Config files that legitimately declare no database URLs.
 *
 * - `vitest.config.ts` is the unit suite. It never connects, and giving it these
 *   variables would hand unit tests a database they should not have.
 * - `vitest.config.integration-base.ts` is where the URLs are actually set. It is
 *   asserted directly below rather than as one of the merging suites.
 */
const EXEMPT_CONFIGS = new Set([
  'vitest.config.ts',
  'vitest.config.integration-base.ts',
]);

const BASE_CONFIG = 'vitest.config.integration-base.ts';

const ALL_CONFIGS = readdirSync(API_ROOT)
  .filter((f) => f.startsWith('vitest.config.') && f.endsWith('.ts'))
  .sort();

const INTEGRATION_CONFIGS = ALL_CONFIGS.filter((f) => !EXEMPT_CONFIGS.has(f));

interface ResolvedEnv {
  DATABASE_URL?: string;
  DATABASE_APP_URL?: string;
}

/**
 * The part of a connection string that decides whether two pools are the same
 * connection: role, host, port, database. Query parameters are deliberately
 * dropped — `?application_name=vitest` makes two URLs differ as strings while
 * `pg` still authenticates both as the same role, which is the collapse this
 * gate exists to catch. Comparing raw strings would pass that; comparing this
 * does not.
 *
 * Throws on a malformed URL rather than returning something incomparable, so a
 * typo fails the gate instead of quietly satisfying it.
 */
function connectionIdentity(url: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a parseable connection URL: ${url}`);
  }
  return [
    parsed.username,
    parsed.hostname,
    parsed.port,
    parsed.pathname, // "/colophony_test"
  ].join('|');
}

/**
 * Import a config and return the `test.env` it actually resolves to.
 *
 * The base exports `integrationBase` as a named export; the suites default-export
 * the result of `mergeConfig`. Both shapes are accepted so the base is checked by
 * the same code path as everything else.
 */
async function resolveEnv(name: string): Promise<ResolvedEnv> {
  const specifier = path.join(API_ROOT, name);
  const mod = (await import(/* @vite-ignore */ specifier)) as Record<
    string,
    unknown
  >;

  const config = (mod.default ?? mod.integrationBase) as
    { test?: { env?: ResolvedEnv } } | undefined;

  if (!config) {
    throw new Error(
      `${name} exports neither a default config nor \`integrationBase\` — ` +
        'this gate could not resolve it, so it is not being checked.',
    );
  }

  return config.test?.env ?? {};
}

const resolved = new Map<string, ResolvedEnv>();

beforeAll(async () => {
  for (const name of [BASE_CONFIG, ...INTEGRATION_CONFIGS]) {
    resolved.set(name, await resolveEnv(name));
  }
});

describe('vitest configs keep the superuser and app pools separate', () => {
  it('discovers and resolves every config', () => {
    // Canary. If a rename or a moved directory made the sweep match nothing,
    // every other test here would pass vacuously.
    expect(ALL_CONFIGS).toContain(BASE_CONFIG);
    expect(INTEGRATION_CONFIGS.length).toBeGreaterThanOrEqual(5);
    expect(resolved.size).toBe(INTEGRATION_CONFIGS.length + 1);
  });

  it.each([BASE_CONFIG, ...INTEGRATION_CONFIGS])(
    '%s resolves the two pools to different connections',
    (name) => {
      const env = resolved.get(name);

      expect(
        env?.DATABASE_URL,
        `${name} resolves no DATABASE_URL. It backs the superuser pool (\`db\`); ` +
          'inherit it by merging integrationBase.',
      ).toBeDefined();

      expect(
        env?.DATABASE_APP_URL,
        `${name} resolves no DATABASE_APP_URL, so \`appPool\` falls back to ` +
          'DATABASE_URL and every withRls() call bypasses the policies it tests.',
      ).toBeDefined();

      // Compare role/host/port/database, not the raw strings — see
      // connectionIdentity above for why a string comparison is not enough.
      expect(
        connectionIdentity(env!.DATABASE_URL!, `${name} DATABASE_URL`),
        `${name} resolves both pools to the same connection. The superuser paths ` +
          '(hooks/auth.ts, hooks/org-context.ts, the webhook handlers, ' +
          'outbox-poller.worker, public.routes) would run under RLS and never be ' +
          'exercised as written — the defect that hid the outbox poller running ' +
          'as app_user. Derive DATABASE_URL from DATABASE_TEST_URL.',
      ).not.toBe(
        connectionIdentity(env!.DATABASE_APP_URL!, `${name} DATABASE_APP_URL`),
      );
    },
  );

  it.each(INTEGRATION_CONFIGS)('%s merges the integration base', (name) => {
    // Resolution above already fails a config that sets neither variable. This
    // adds the reason: inheriting the base is also what supplies the
    // assert-pool-separation setup file, which has no resolved value to check.
    expect(
      readFileSync(path.join(API_ROOT, name), 'utf8'),
      `${name} does not import integrationBase, so it inherits neither the two ` +
        'database URLs nor the assert-pool-separation setup file. Build it with ' +
        'mergeConfig(integrationBase, { ... }) like the other suites.',
    ).toContain("from './vitest.config.integration-base'");
  });

  it('registers the pool-separation guard in the base setupFiles', () => {
    // Not a resolved-value check: setupFiles is a path list, and what matters is
    // that the runtime guard is wired in at all.
    expect(
      readFileSync(path.join(API_ROOT, BASE_CONFIG), 'utf8'),
      'integration base must register assert-pool-separation.ts in setupFiles, ' +
        'or nothing enforces the split once the suites actually run.',
    ).toContain('assert-pool-separation');
  });
});
