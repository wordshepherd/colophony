---
name: new-migration
description: Add a new Drizzle schema table with migration and RLS via pgPolicy.
---

# /new-migration

Add a new Drizzle schema table with migration and RLS via pgPolicy.

## What this skill does

1. Adds a new table schema to `packages/db/src/schema/`
2. Includes pgPolicy for RLS enforcement
3. Generates a Drizzle migration
4. Exports from the schema barrel

## Usage

```
/new-migration <TableName>                  # Add org-scoped table (RLS enforced)
/new-migration <TableName> --no-rls         # Add global table (no RLS, e.g. users)
/new-migration <TableName> --fields "name:text, amount:integer"  # With initial columns
```

## Instructions for Claude

When the user invokes `/new-migration <TableName>`:

1. **Create the schema file** at `packages/db/src/schema/<tableName>.ts`:

For org-scoped tables (default):

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

    // RLS policies — org isolation
    pgPolicy('org_isolation_select', {
      for: 'select',
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
    pgPolicy('org_isolation_insert', {
      for: 'insert',
      withCheck: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
    pgPolicy('org_isolation_update', {
      for: 'update',
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
      withCheck: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
    pgPolicy('org_isolation_delete', {
      for: 'delete',
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
).enableRLS();
```

For global tables (`--no-rls`):

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

2. **Export from barrel** in `packages/db/src/schema/index.ts`:
   - Add: `export { <tableNames> } from './<tableName>';`

3. **Generate the migration**:

```bash
pnpm --filter @colophony/db drizzle-kit generate --name add_<table_names>
```

4. **Review the generated SQL** in `packages/db/drizzle/`:
   - Verify the migration SQL includes `ENABLE ROW LEVEL SECURITY` for org-scoped tables
   - Verify `FORCE ROW LEVEL SECURITY` is present
   - Verify all pgPolicy statements are included
   - Add `GRANT SELECT, INSERT, UPDATE, DELETE ON <table_names> TO app_user;` if not present

5. **Apply the migration**:

```bash
pnpm db:migrate
```

6. **Add Drizzle relations** (optional) in `packages/db/src/schema/relations.ts`:

```typescript
import { relations } from 'drizzle-orm';
import { <tableNames> } from './<tableName>';
import { organizations } from './organizations';

export const <tableNames>Relations = relations(<tableNames>, ({ one }) => ({
  organization: one(organizations, {
    fields: [<tableNames>.organizationId],
    references: [organizations.id],
  }),
}));
```

7. **Inform the user**:

```
Created:
- packages/db/src/schema/<tableName>.ts
- packages/db/drizzle/<timestamp>_add_<table_names>.sql

Updated:
- packages/db/src/schema/index.ts

Next steps:
1. Review the generated migration SQL
2. Consider adding a route: `/new-route <name>`
3. Consider adding Zod schemas to packages/api-contracts/src/
4. Run `pnpm build` to verify TypeScript compiles
```

## Important notes

- Table names use **plural snake_case** (e.g., `TableName` → `table_names`)
- Always include `organizationId` for org-scoped tables (RLS depends on it)
- `enableRLS()` on the table + pgPolicy definitions handle everything — no separate SQL file needed
- FORCE ROW LEVEL SECURITY is set by `enableRLS()` in the migration
- The `app_user` GRANT must be in the migration SQL for the non-superuser application role
- Use `$onUpdate(() => new Date())` for automatic `updatedAt` tracking
