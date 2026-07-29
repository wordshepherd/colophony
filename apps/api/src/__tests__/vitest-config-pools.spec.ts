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
 * `globalSetup`). Both only run for suites that are already wired up. This spec
 * covers the gap they cannot: a config file that is wrong, or new, before any of
 * its tests execute.
 *
 * Needs no database, so it belongs in the unit suite — and lands there: the
 * include pattern in `vitest.config.ts` covers every `.test.ts` and `.spec.ts`
 * under `src`, and its exclude list names only the five specialized child
 * directories, so a `.spec.ts` directly under `src/__tests__/` is collected.
 * (Contrast the note in `security/unprotected-table-callsites.test.ts`, where a
 * `.spec.ts` inside one of those excluded directories would be collected by no
 * suite at all.)
 *
 * It reads the configs as text rather than importing them. Importing is what one
 * would reach for first, and it does not work here: the configs sit beside
 * `src/`, not inside it, so a static import fails `tsc` with TS6059
 * (`rootDir` is `src`). A dynamic `import()` of a discovered path dodges the
 * type error only by dodging type-checking, and then depends on the process CWD
 * and vitest's SSR loader. A text sweep has neither problem, and it is the idiom
 * `security/unprotected-table-callsites.test.ts` already uses for the same kind
 * of "no new file may quietly do X" gate.
 */
import { describe, it, expect } from 'vitest';
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
 * - `vitest.config.integration-base.ts` is where the URLs are actually set, and
 *   it is the thing every other config must merge — so it is the subject of the
 *   assertions below rather than a target of them.
 */
const EXEMPT_CONFIGS = new Set([
  'vitest.config.ts',
  'vitest.config.integration-base.ts',
]);

const BASE_CONFIG = 'vitest.config.integration-base.ts';

function readConfig(name: string): string {
  return readFileSync(path.join(API_ROOT, name), 'utf8');
}

const ALL_CONFIGS = readdirSync(API_ROOT)
  .filter((f) => f.startsWith('vitest.config.') && f.endsWith('.ts'))
  .sort();

const INTEGRATION_CONFIGS = ALL_CONFIGS.filter((f) => !EXEMPT_CONFIGS.has(f));

/**
 * The exact shape of the original defect: the superuser variable assigned from
 * the app_user one. Tolerates whitespace and line breaks, because prettier wraps
 * these assignments across lines.
 */
const DERIVES_ADMIN_FROM_APP =
  /DATABASE_URL\s*:\s*(?:\/\/[^\n]*\n\s*)*process\.env\.DATABASE_APP_URL/;

describe('vitest configs keep the superuser and app pools separate', () => {
  it('discovers the integration configs', () => {
    // Canary. If a rename or a moved directory made the sweep match nothing,
    // every other test here would pass vacuously.
    expect(ALL_CONFIGS).toContain(BASE_CONFIG);
    expect(INTEGRATION_CONFIGS.length).toBeGreaterThanOrEqual(5);
  });

  it.each([BASE_CONFIG, ...INTEGRATION_CONFIGS])(
    '%s does not derive DATABASE_URL from DATABASE_APP_URL',
    (name) => {
      expect(
        DERIVES_ADMIN_FROM_APP.test(readConfig(name)),
        `${name} points the superuser pool at the app_user connection. ` +
          'Both pools then share one role, so the superuser paths ' +
          '(hooks/auth.ts, hooks/org-context.ts, the webhook handlers, ' +
          'outbox-poller.worker, public.routes) run under RLS and are never ' +
          'exercised as written. Derive DATABASE_URL from DATABASE_TEST_URL.',
      ).toBe(false);
    },
  );

  it.each(INTEGRATION_CONFIGS)('%s merges the integration base', (name) => {
    expect(
      readConfig(name),
      `${name} does not import integrationBase, so it inherits neither the two ` +
        'database URLs nor the assert-pool-separation setup file. Build it with ' +
        'mergeConfig(integrationBase, { ... }) like the other suites.',
    ).toContain("from './vitest.config.integration-base'");
  });

  it('sets both database URLs in the integration base', () => {
    const base = readConfig(BASE_CONFIG);

    expect(base, 'integration base must set DATABASE_URL').toMatch(
      /DATABASE_URL\s*:/,
    );
    expect(
      base,
      'integration base must set DATABASE_APP_URL — without it `appPool` falls ' +
        'back to DATABASE_URL and every withRls() call bypasses the policies it ' +
        'is meant to prove.',
    ).toMatch(/DATABASE_APP_URL\s*:/);
    expect(
      base,
      'integration base must register assert-pool-separation.ts in setupFiles.',
    ).toContain('assert-pool-separation');
  });
});
