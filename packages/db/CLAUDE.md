# @colophony/db — Database Package

## Key Paths

| What           | Path                                     |
| -------------- | ---------------------------------------- |
| Schema files   | `src/schema/` (one file per table group) |
| Schema barrel  | `src/schema/index.ts`                    |
| DB client/pool | `src/client.ts`                          |
| RLS context    | `src/context.ts` (`withRls()`)           |
| Type exports   | `src/types.ts`                           |
| Migrations     | `migrations/`                            |

### Schema Files (20 domain files + barrel)

`api-keys.ts`, `audit.ts`, `cms.ts`, `compliance.ts`, `contracts.ts`, `enums.ts`, `federation.ts`, `issues.ts`, `manuscripts.ts`, `members.ts`, `messaging.ts`, `organizations.ts`, `payments.ts`, `pipeline.ts`, `publications.ts`, `relations.ts`, `submissions.ts`, `user-keys.ts`, `users.ts`, `webhooks.ts`, `index.ts`

---

## RLS Multi-Tenancy (CRITICAL)

This is the **authoritative location** for RLS rules. All other docs reference here.

RLS policies are defined directly in Drizzle schema via `pgPolicy`. Org context is set via `SET LOCAL` (transaction-scoped) before any tenant query.

```typescript
// Drizzle schema — pgPolicy inline with table definition
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    // ... fields
  },
  (table) => [
    pgPolicy("submissions_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
);
```

### Connection Pools (`src/client.ts`)

- **`pool`** — superuser (`colophony`). Used for migrations, admin tasks, and the Drizzle `db` instance.
- **`appPool`** — non-superuser (`app_user`, `NOBYPASSRLS`). Used by `withRls()` and the `dbContext` hook for all request-scoped queries. Configured via `DATABASE_APP_URL` (falls back to `DATABASE_URL`).

**Always use `appPool` for tenant data queries.** The superuser `pool` bypasses all RLS policies.

### `withRls()` — RLS transaction helper (`src/context.ts`)

```typescript
async function withRls<T>(
  ctx: { orgId?: string; userId?: string },
  fn: (tx: DrizzleDb) => Promise<T>,
): Promise<T>;
```

Acquires a dedicated connection, sets `app.current_org` and/or `app.user_id` via `set_config(..., true)` (transaction-local), runs the callback inside a transaction, releases the connection. Context is automatically cleared when the transaction ends.

### User-Scoped RLS (Manuscripts)

Manuscripts use `owner_id = current_user_id()` instead of org-scoped isolation. The `current_user_id()` SQL function (migration 0000) returns `app.user_id`. Files use dual RLS: owner CRUD via manuscript ownership chain (`files → manuscript_versions → manuscripts WHERE owner_id = current_user_id()`) + org SELECT for editors on submitted manuscripts (`files → manuscript_versions → submissions WHERE organization_id = current_org_id()`). This is a new pattern — all other tables use org-scoped isolation only.

### NEVER

- Query tenant data without setting org context via `SET LOCAL`
- Use session-level `SET` (always `SET LOCAL` inside transaction — critical with connection pooling)
- Manually filter by `organizationId` (RLS does this)
- Use `app.current_user` (reserved keyword — use `app.user_id`)
- Skip `FORCE ROW LEVEL SECURITY` on tenant tables
- Make `app_user` a superuser (superusers bypass RLS)
- Use `INSERT...RETURNING` when SELECT policy is stricter than INSERT (e.g., `audit_events`) — the RETURNING clause reads the row back via SELECT, so both policies must pass. Drop `.returning()` or widen the SELECT policy.
- Pass `organizationId` to `auditService.log()` in user-scoped `withRls({ userId })` context — the `audit_events` INSERT policy requires `organization_id IS NULL OR organization_id = current_org_id()`. With no org context set, a non-NULL `organization_id` fails the check. Omit `organizationId` from audit params when org context is not set; `actorId` provides traceability.

**ALWAYS:** Test multi-tenancy isolation in every feature that touches tenant data.

---

## Migration Workflow

```bash
pnpm db:generate              # Generate migration from schema changes
pnpm db:migrate               # Validate journal + run Drizzle migrations
pnpm db:seed                  # Seed test data
pnpm db:reset                 # Drop and recreate with migrations + RLS + verify
pnpm db:verify                # Check FK constraints match expected state (exit 1 on mismatch)
pnpm db:verify:repair         # Check + auto-repair any mismatched FK constraints
pnpm db:validate-migrations   # Check SQL files ↔ journal consistency
pnpm db:validate-migrations:fix  # Auto-add missing journal entries
pnpm db:add-migration <name>  # Add journal entry for a manual migration
```

**Manual migration workflow:** When `drizzle-kit generate` blocks (TUI in non-interactive shells), write the SQL file manually, then run `pnpm db:add-migration <name>` to add the journal entry. The `post-migration-validate` Claude hook warns if a journal entry is missing when editing migration files. `pnpm db:migrate` also validates journal consistency before running.

**Drizzle `migrate()` silent no-op workaround:** Drizzle ORM 0.44+ / journal v7 can silently record a migration as applied without executing its DDL on existing databases. `db:verify` detects this for migration 0015 (GDPR FK constraints). Run `db:verify` after `db:migrate` in production deployments. If mismatches are found, run `db:verify:repair` to re-apply the correct DDL.

**init-db.sh caveat:** Only runs on first DB creation. Must `docker compose down -v` to re-run after changes.

### Production RLS Verification

```bash
# Confirm app_user is NOT a superuser
docker compose exec postgres psql -U colophony -c \
  "SELECT usename, usesuper FROM pg_user WHERE usename = 'app_user';"
# Confirm FORCE ROW LEVEL SECURITY on tenant tables
docker compose exec postgres psql -U colophony -c \
  "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ('submissions', 'payments');"
```

---

## Quirks

| Quirk                                          | Details                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pgPolicy` import path**                     | Import `pgPolicy` from `drizzle-orm/pg-core`, not the top-level export                                                                                                                                                                                                                                                                                |
| **JSONB queries need raw SQL**                 | No native JSONB operators yet. Use `sql` template tag. Track Drizzle JSONB roadmap (Q2 2026)                                                                                                                                                                                                                                                          |
| **`migrate()` silent no-op after schema drop** | `migrate(db, { migrationsFolder })` completes without error but creates zero tables after `DROP SCHEMA CASCADE; CREATE SCHEMA public`. Use manual SQL execution (read `_journal.json`, split on `--> statement-breakpoint`). Affects Drizzle ORM 0.44 with journal v7                                                                                 |
| **`migrate()` skips SQL files not in journal** | If `.sql` migration files exist in `migrations/` but have no corresponding entry in `meta/_journal.json`, `migrate()` silently skips them — no error, no warning. Mitigated: `pnpm db:migrate` now validates journal consistency first; `post-migration-validate` hook warns on edit; `pnpm db:add-migration <name>` automates journal entry creation |

## Version Pin

| Package     | Pinned        | Notes                                        |
| ----------- | ------------- | -------------------------------------------- |
| Drizzle ORM | latest stable | Schema API evolving; pin after initial setup |
