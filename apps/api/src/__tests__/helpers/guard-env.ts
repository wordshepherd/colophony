/**
 * `process.env` setup for specs that exercise the Fastify `internalOnly` guard.
 *
 * The guard calls `validateEnv()` per request — deliberately, because a
 * module-level call breaks test imports — and `validateEnv()` re-parses
 * `process.env` and ignores the `Env` a spec passes to a route registrar. The
 * unit-test vitest config sets no `DATABASE_URL`, so an unprepared spec gets a
 * ZodError out of the guard and sees a **500 where it expected a 403**, which
 * reads like a broken guard rather than a missing variable.
 *
 * Prefer this over `vi.mock('../config/env.js')` in route specs: it exercises the
 * real schema, so a spec cannot pass against an env shape that could not parse in
 * production. The tRPC specs mock instead because they need to flip enforcement
 * mid-file without touching the process.
 */
const REQUIRED = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
} as const;

/**
 * Apply the variables the guard needs and return a restore function.
 *
 * ```ts
 * let restoreEnv: () => void;
 * beforeAll(() => { restoreEnv = applyGuardEnv(); });
 * afterAll(() => { restoreEnv(); });
 * ```
 */
export function applyGuardEnv(
  overrides: Record<string, string> = {},
): () => void {
  const values = { ...REQUIRED, ...overrides };
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return function restoreGuardEnv() {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}
