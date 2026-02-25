---
name: new-migration
description: Add a new Drizzle schema table with migration and RLS via pgPolicy.
---

# /new-migration

Add a new Drizzle schema table with migration and RLS via pgPolicy.

## Usage

```
/new-migration <TableName>                  # Add org-scoped table (default)
/new-migration <TableName> --user-scoped    # Add user-scoped table (owner RLS)
/new-migration <TableName> --no-rls         # Add global table (no RLS)
/new-migration <TableName> --fields "name:text, amount:integer"  # With initial columns
```

## Instructions for Claude

When the user invokes `/new-migration <TableName>`:

### Step 1: Create the schema file

Create `packages/db/src/schema/<tableName>.ts` using the appropriate RLS mode.

**Org-scoped (default):**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const <tableNames> = pgTable(
  '<table_names>',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    // TODO: Add columns here
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_<table_names>_org').on(table.organizationId),
    index('idx_<table_names>_created').on(table.createdAt),

    // RLS policy — org isolation (single FOR ALL policy, matches 0021 pattern)
    pgPolicy('<table_names>_org_isolation', {
      for: 'all',
      using: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
```

**User-scoped (`--user-scoped`):**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const <tableNames> = pgTable(
  '<table_names>',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // TODO: Add columns here
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_<table_names>_user').on(table.userId),
    index('idx_<table_names>_created').on(table.createdAt),

    // RLS policies — user-scoped (matches 0024 pattern)
    pgPolicy('<table_names>_owner_select', {
      for: 'select',
      using: sql`user_id = current_setting('app.user_id', true)::uuid`,
    }),
    pgPolicy('<table_names>_owner_insert', {
      for: 'insert',
      withCheck: sql`user_id = current_setting('app.user_id', true)::uuid`,
    }),
  ],
).enableRLS();
```

**Global (`--no-rls`):**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const <tableNames> = pgTable('<table_names>', {
  id: uuid('id').primaryKey().defaultRandom(),
  // TODO: Add columns here
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

### Step 2: Export from barrel

Add to `packages/db/src/schema/index.ts`:

```typescript
export { <tableNames> } from './<tableName>';
```

### Step 3: Generate the migration

Run with a timeout to detect TUI blocking:

```bash
timeout 8 pnpm db:generate --name add_<table_names>
```

> **Portability note:** On macOS, `timeout` is not available by default. Use `gtimeout` from `brew install coreutils`, or skip to the manual fallback.

- **Exit 0**: Migration generated successfully. Skip to Step 4.
- **Exit 124** (timeout — TUI blocked): Proceed to Step 3a (manual fallback).
- **Any other nonzero exit**: Surface the error to the user. Do NOT fall back — this likely indicates a real schema error (syntax, import, type mismatch).

#### Step 3a: Read the journal

Read `packages/db/migrations/meta/_journal.json`. Find the last entry's `idx` and `when` values.

Compute:

- `nextIdx = lastEntry.idx + 1`
- `nextWhen = lastEntry.when + 200000000`
- `paddedIdx = String(nextIdx).padStart(4, '0')`
- `tag = "<paddedIdx>_add_<table_names>"`

#### Step 3b: Write the SQL migration file

Write to `packages/db/migrations/<paddedIdx>_add_<table_names>.sql`.

**Org-scoped template** (matches migration 0021 pattern):

```sql
-- <paddedIdx>: Add <table_names> table

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "<table_names>" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  -- TODO: Add columns here
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "<table_names>"
    ADD CONSTRAINT "<table_names>_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "<table_names>_organization_id_idx" ON "<table_names>" ("organization_id");

--> statement-breakpoint

-- RLS
ALTER TABLE "<table_names>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<table_names>" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "<table_names>_org_isolation" ON "<table_names>"
    FOR ALL
    USING (organization_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint

-- GRANT permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "<table_names>" TO app_user;

--> statement-breakpoint

-- updatedAt trigger (idempotent)
DROP TRIGGER IF EXISTS "trg_<table_names>_set_updated_at" ON "<table_names>";
CREATE TRIGGER "trg_<table_names>_set_updated_at"
  BEFORE UPDATE ON "<table_names>"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

**User-scoped template** (matches migration 0024 pattern):

```sql
-- <paddedIdx>: Add <table_names> table (user-scoped)

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "<table_names>" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- TODO: Add columns here
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "<table_names>_user_id_idx" ON "<table_names>" ("user_id");

--> statement-breakpoint

-- RLS
ALTER TABLE "<table_names>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<table_names>" FORCE ROW LEVEL SECURITY;

CREATE POLICY "<table_names>_owner_select" ON "<table_names>" FOR SELECT
  USING (user_id = current_setting('app.user_id', true)::uuid);

--> statement-breakpoint

CREATE POLICY "<table_names>_owner_insert" ON "<table_names>" FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

--> statement-breakpoint

-- GRANT permissions to app_user (no DELETE by default for user-scoped)
GRANT SELECT, INSERT, UPDATE ON "<table_names>" TO app_user;

--> statement-breakpoint

-- updatedAt trigger (idempotent)
DROP TRIGGER IF EXISTS "trg_<table_names>_set_updated_at" ON "<table_names>";
CREATE TRIGGER "trg_<table_names>_set_updated_at"
  BEFORE UPDATE ON "<table_names>"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

**Global template** (no RLS):

```sql
-- <paddedIdx>: Add <table_names> table (no RLS)

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "<table_names>" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- TODO: Add columns here
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- GRANT permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "<table_names>" TO app_user;

--> statement-breakpoint

-- updatedAt trigger (idempotent)
DROP TRIGGER IF EXISTS "trg_<table_names>_set_updated_at" ON "<table_names>";
CREATE TRIGGER "trg_<table_names>_set_updated_at"
  BEFORE UPDATE ON "<table_names>"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

#### Step 3c: Append journal entry

Add a new entry to the `entries` array in `packages/db/migrations/meta/_journal.json`:

```json
{
  "idx": <nextIdx>,
  "version": "7",
  "when": <nextWhen>,
  "tag": "<paddedIdx>_add_<table_names>",
  "breakpoints": true
}
```

No snapshot file is needed — most existing migrations lack snapshots and `migrate` does not require them.

### Step 4: Review and apply

Review the migration SQL. Then apply:

```bash
pnpm db:migrate
```

### Step 5: Add Drizzle relations (optional)

In `packages/db/src/schema/relations.ts`:

```typescript
import { relations } from 'drizzle-orm';
import { <tableNames> } from './<tableName>';

// For org-scoped:
import { organizations } from './organizations';
export const <tableNames>Relations = relations(<tableNames>, ({ one }) => ({
  organization: one(organizations, {
    fields: [<tableNames>.organizationId],
    references: [organizations.id],
  }),
}));

// For user-scoped:
import { users } from './users';
export const <tableNames>Relations = relations(<tableNames>, ({ one }) => ({
  user: one(users, {
    fields: [<tableNames>.userId],
    references: [users.id],
  }),
}));
```

### Step 6: Inform the user

Distinguish between primary and fallback paths in output:

**If `db:generate` succeeded (primary path):**

```
Created:
- packages/db/src/schema/<tableName>.ts
- packages/db/migrations/<timestamp>_add_<table_names>.sql (drizzle-kit generated)

Updated:
- packages/db/src/schema/index.ts

Next steps:
1. Review the generated migration SQL
2. Run `pnpm db:migrate` to apply
3. Consider adding a route: `/new-route <name>`
4. Run `pnpm build` to verify TypeScript compiles
```

**If manual fallback was used:**

```
Created:
- packages/db/src/schema/<tableName>.ts
- packages/db/migrations/<paddedIdx>_add_<table_names>.sql (manual — drizzle-kit TUI blocked)

Updated:
- packages/db/src/schema/index.ts
- packages/db/migrations/meta/_journal.json

Note: Migration was scaffolded manually (no snapshot file). This is fine —
`migrate` does not require snapshots, and most existing migrations lack them.
If you later run `drizzle-kit generate` interactively, it may regenerate snapshots.

Next steps:
1. Review the migration SQL and fill in TODO columns
2. Run `pnpm db:migrate` to apply
3. Consider adding a route: `/new-route <name>`
4. Run `pnpm build` to verify TypeScript compiles
```

## Important notes

- Table names use **plural snake_case** (e.g., `TableName` → `table_names`)
- Always include `organizationId` for org-scoped tables (RLS depends on it)
- Always include `userId` for user-scoped tables (RLS depends on it)
- `enableRLS()` on the table + pgPolicy definitions handle everything — no separate SQL file needed
- FORCE ROW LEVEL SECURITY is set by `enableRLS()` in the migration
- The `app_user` GRANT must be in the migration SQL for the non-superuser application role
- Use `$onUpdate(() => new Date())` for automatic `updatedAt` tracking
- Org-scoped RLS uses `current_org_id()` helper (single `FOR ALL` policy)
- User-scoped RLS uses `current_setting('app.user_id', true)::uuid` (separate per-operation policies)
- **`db:push` is for dev iteration only** — it is a destructive command that can drop columns/tables to match schema. Never use against production. It targets whatever database `DATABASE_URL` points to in your config.
