/**
 * Driver-level Postgres error predicates for the service layer.
 *
 * Separate from `errors.ts`, which holds *domain* errors and role assertions —
 * this file is about what the database driver hands back, not what the domain
 * means by it.
 */

/**
 * True for a Postgres unique-violation (SQLSTATE 23505).
 *
 * Walks the `cause` chain because Drizzle wraps driver errors in a
 * `DrizzleQueryError` and the pg error — the one carrying `code` — is the cause.
 * Checking `err.code` directly silently never matches: the catch block looks
 * correct, compiles, and quietly rethrows every unique violation as a 500. That
 * is not hypothetical; it is what `issueService.addItemWithAudit` did until
 * 2026-07-31, and no unit spec could catch it because a mocked `tx` never
 * produces a real driver error.
 *
 * Matches on the SQLSTATE, not the message. `pipelineService.saveCopyedit`
 * string-matches 'unique constraint' for its retry and predates this; do not
 * copy that spelling.
 *
 * Lives here rather than beside its first caller so there is one copy. A
 * per-file copy is how these drift — `queue-preset.service.ts` still carries a
 * private function of the same name using the broken direct check.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  // Bounded so a self-referential cause cannot spin.
  for (let depth = 0; depth < 5; depth++) {
    if (current === null || typeof current !== 'object') return false;
    if ('code' in current && current.code === '23505') return true;
    if (!('cause' in current)) return false;
    current = current.cause;
  }
  return false;
}
