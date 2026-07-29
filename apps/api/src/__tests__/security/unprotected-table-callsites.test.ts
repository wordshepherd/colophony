/**
 * Call-site tripwire for the two unprotected tables.
 *
 * THIS IS A REVIEW TRIPWIRE, NOT A SECURITY GATE. It is file-level, so a new
 * query added to a file already on the list passes silently. Its only job is to
 * make a `users` or `organizations` query appearing in a NEW file fail the
 * build, so whoever adds it classifies it in `docs/tenant-isolation-audit.md`
 * rather than it landing unreviewed.
 *
 * The load-bearing gate is `__tests__/rls/rls-infrastructure.test.ts`, which
 * checks the live catalog. This one is cheap insurance on top.
 *
 * Why it exists at all: `users` and `organizations` have no RLS and no
 * compensating REVOKE, so on those two tables an explicit `WHERE` clause in the
 * service layer is the entire isolation story. Every read of them is worth a
 * human deciding whether it is scoped, and this list is the record that someone
 * did.
 *
 * Needs no database, but is named `.test.ts` and lives here deliberately:
 * `vitest.config.ts` excludes `src/__tests__/security/**` and
 * `vitest.config.security.ts` includes only `*.test.ts`, so a `.spec.ts` in this
 * directory would be collected by no suite at all and silently never run.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// `__dirname`, not `import.meta` — this package type-checks against a CommonJS
// target, which rejects `import.meta` outright (TS1470). Matches
// `../rls/helpers/db-setup.ts`.
const API_SRC = path.resolve(__dirname, '../..');

/**
 * Every way the codebase reaches these tables. All four forms are represented in
 * the tree today, and dropping any one of them makes the sweep incomplete:
 *   - `.from(users)` / `.update(organizations)` — the common Drizzle builder
 *   - `.leftJoin(users, ...)` — six files reach `users` ONLY this way
 *   - `alias(users, 'copyeditors')` — `pipeline.service.ts` does this ×6, and a
 *     bare-name grep for `from(users)` misses every one
 *   - `db.query.users.findFirst` — the relational API
 *   - raw SQL inside `sql` blocks and `client.query(...)`
 *
 * The raw-SQL branch must cover writes as well as reads. `FROM` / `JOIN` alone
 * catches `SELECT … FROM users` and `DELETE FROM users` (both present in
 * `gdpr.service.ts`), but `UPDATE users SET …` and `INSERT INTO organizations …`
 * have neither keyword, and the Drizzle branch does not apply because raw SQL
 * has no `update(` / `into(` call. Those are writes to unprotected tables — the
 * accesses that most need review — so they are matched explicitly.
 */
const ACCESS_PATTERN =
  /(?:from|innerJoin|leftJoin|rightJoin|fullJoin|alias|update|delete|into)\(\s*(?:users|organizations)\b|(?:db|tx)\.query\.(?:users|organizations)\b|(?:FROM|JOIN|INTO|UPDATE)\s+(?:users|organizations)\b/i;

/**
 * Files known to read or write `users` / `organizations`, each classified in
 * `docs/tenant-isolation-audit.md`. Adding a file here without a corresponding
 * entry in that document defeats the point.
 */
const CLASSIFIED_CALLSITE_FILES: readonly string[] = [
  'hooks/auth.ts',
  'hooks/org-context.ts',
  'inngest/functions/cms-publish.ts',
  'inngest/functions/contract-workflow.ts',
  'inngest/functions/discussion-notifications.ts',
  'inngest/functions/embed-submission-confirmation.ts',
  'inngest/functions/reviewer-notifications.ts',
  'inngest/functions/slate-notifications.ts',
  'inngest/functions/submission-notifications.ts',
  'inngest/functions/submission-response-reminder.ts',
  'routes/public.routes.ts',
  'services/contest.service.ts',
  'services/correspondence.service.ts',
  'services/csr.service.ts',
  'services/embed-submission.service.ts',
  'services/federation.service.ts',
  'services/gdpr.service.ts',
  'services/invitation.service.ts',
  'services/migration-bundle.service.ts',
  'services/migration.service.ts',
  'services/organization.service.ts',
  'services/pipeline.service.ts',
  'services/portfolio.service.ts',
  'services/response-time-transparency.service.ts',
  'services/simsub-group.service.ts',
  'services/simsub.service.ts',
  'services/status-token.service.ts',
  'services/submission-discussion.service.ts',
  'services/submission-reviewer.service.ts',
  'services/submission-vote.service.ts',
  'services/submission.service.ts',
  'services/transfer.service.ts',
  'services/trust.service.ts',
  'services/user.service.ts',
  'webhooks/tusd.webhook.ts',
  'webhooks/zitadel.webhook.ts',
];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) continue;
    acc.push(full);
  }
  return acc;
}

describe('users / organizations call sites are classified', () => {
  const actual = collectSourceFiles(API_SRC)
    .filter((f) => ACCESS_PATTERN.test(readFileSync(f, 'utf8')))
    .map((f) => path.relative(API_SRC, f).split(path.sep).join('/'))
    .sort();

  it('has no unclassified file reading users or organizations', () => {
    const unclassified = actual.filter(
      (f) => !CLASSIFIED_CALLSITE_FILES.includes(f),
    );
    expect(
      unclassified,
      'These files query `users` or `organizations`, which have NO row-level security — ' +
        'an explicit WHERE clause is the only thing isolating tenants there. Classify each ' +
        'new read in docs/tenant-isolation-audit.md, then add the file here.',
    ).toEqual([]);
  });

  it('has no stale entries', () => {
    const stale = CLASSIFIED_CALLSITE_FILES.filter((f) => !actual.includes(f));
    expect(
      stale,
      'Listed file(s) no longer query users/organizations — remove them here and in the audit doc.',
    ).toEqual([]);
  });
});
