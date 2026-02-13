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

### Schema Files (11 domain files + barrel)

`audit.ts`, `compliance.ts`, `enums.ts`, `members.ts`, `messaging.ts`, `organizations.ts`, `payments.ts`, `relations.ts`, `submissions.ts`, `users.ts`, `webhooks.ts`, `index.ts`

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

### `withRls()` — RLS transaction helper (`src/context.ts`)

```typescript
async function withRls<T>(
  ctx: { orgId?: string; userId?: string },
  fn: (tx: DrizzleDb) => Promise<T>,
): Promise<T>;
```

Acquires a dedicated connection, sets `app.current_org` and/or `app.user_id` via `set_config(..., true)` (transaction-local), runs the callback inside a transaction, releases the connection. Context is automatically cleared when the transaction ends.

### NEVER

- Query tenant data without setting org context via `SET LOCAL`
- Use session-level `SET` (always `SET LOCAL` inside transaction — critical with connection pooling)
- Manually filter by `organizationId` (RLS does this)
- Use `app.current_user` (reserved keyword — use `app.user_id`)
- Skip `FORCE ROW LEVEL SECURITY` on tenant tables
- Make `app_user` a superuser (superusers bypass RLS)
- Use `INSERT...RETURNING` when SELECT policy is stricter than INSERT (e.g., `audit_events`) — the RETURNING clause reads the row back via SELECT, so both policies must pass. Drop `.returning()` or widen the SELECT policy.

**ALWAYS:** Test multi-tenancy isolation in every feature that touches tenant data.

---

## Migration Workflow

```bash
pnpm db:generate    # Generate migration from schema changes
pnpm db:migrate     # Run Drizzle migrations
pnpm db:seed        # Seed test data
pnpm db:reset       # Drop and recreate with migrations + RLS
```

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

| Quirk                                          | Details                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pgPolicy` import path**                     | Import `pgPolicy` from `drizzle-orm/pg-core`, not the top-level export                                                                                                                                                                                                |
| **JSONB queries need raw SQL**                 | No native JSONB operators yet. Use `sql` template tag. Track Drizzle JSONB roadmap (Q2 2026)                                                                                                                                                                          |
| **`migrate()` silent no-op after schema drop** | `migrate(db, { migrationsFolder })` completes without error but creates zero tables after `DROP SCHEMA CASCADE; CREATE SCHEMA public`. Use manual SQL execution (read `_journal.json`, split on `--> statement-breakpoint`). Affects Drizzle ORM 0.44 with journal v7 |

## Version Pin

| Package     | Pinned        | Notes                                        |
| ----------- | ------------- | -------------------------------------------- |
| Drizzle ORM | latest stable | Schema API evolving; pin after initial setup |
