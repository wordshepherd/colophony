/**
 * Setup-file guard: the two database URLs must not be the same.
 *
 * `packages/db/src/client.ts` builds two pools from two variables —
 * `DATABASE_URL` for the superuser `pool`/`db`, `DATABASE_APP_URL` for the
 * `app_user` `appPool` behind `withRls()`. Production keeps them distinct.
 * A vitest config that derives one from the other collapses them, and every
 * code path that reaches for the superuser pool *in order to bypass RLS* then
 * runs under RLS instead — silently, because it still returns rows for the
 * unprotected tables most of those paths touch.
 *
 * Nothing else catches this. `client.ts` suppresses its own [SECURITY WARNING]
 * when NODE_ENV is `test`, which vitest always sets, and `appPool` falls back to
 * `DATABASE_URL` when `DATABASE_APP_URL` is missing — so the collapse survives
 * an unset variable in either direction. Removing that suppression is not the
 * fix: the unit suite sets neither variable and never connects, so it would fail
 * every unit test through `test/vitest-console-setup.ts` on a warning that does
 * not apply.
 *
 * This is the cheap half of the check — string comparison, no connection, so it
 * runs for every file including the handful that need no database. The half that
 * actually verifies the roles is in `../rls/helpers/db-setup.ts`: two URLs can
 * differ as strings and still resolve to the same PostgreSQL role.
 *
 * Loaded via `setupFiles` in `vitest.config.integration-base.ts`, and called at
 * module scope so it fails before any test body or `beforeAll` hook runs.
 */

function assertPoolSeparation(): void {
  const adminUrl = process.env.DATABASE_URL;
  const appUrl = process.env.DATABASE_APP_URL;

  const hint =
    'Set both in the `env` block of vitest.config.integration-base.ts — ' +
    'DATABASE_URL from DATABASE_TEST_URL (superuser), DATABASE_APP_URL from ' +
    'DATABASE_APP_URL (app_user). See docs/testing.md.';

  if (!adminUrl) {
    throw new Error(
      `DATABASE_URL is not set for this integration suite. ${hint}`,
    );
  }

  if (!appUrl) {
    throw new Error(
      'DATABASE_APP_URL is not set for this integration suite, so `appPool` ' +
        'falls back to DATABASE_URL and RLS is bypassed wherever `withRls()` ' +
        `is used. ${hint}`,
    );
  }

  if (adminUrl === appUrl) {
    throw new Error(
      'DATABASE_URL and DATABASE_APP_URL are identical, so the superuser pool ' +
        '(`db`) and the app pool (`appPool`) are the same connection. Every ' +
        'documented superuser path runs under RLS and is never exercised as ' +
        `written. ${hint}`,
    );
  }
}

assertPoolSeparation();
