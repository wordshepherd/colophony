# /new-migration

Add a new Prisma model with migration and RLS policies.

## What this skill does

1. Adds a new model to `packages/db/prisma/schema.prisma`
2. Generates a Prisma migration
3. Appends RLS policies to `packages/db/prisma/rls-policies.sql`
4. Regenerates the Prisma client
5. Reminds to run `/db-reset` to apply RLS

## Usage

```
/new-migration <ModelName>                  # Add org-scoped model (RLS enforced)
/new-migration <ModelName> --no-rls         # Add global model (no RLS, e.g. users)
/new-migration <ModelName> --fields "name:String, amount:Int"  # With initial fields
```

## Instructions for Claude

When the user invokes `/new-migration <ModelName>`:

1. **Add the model** to `packages/db/prisma/schema.prisma`:

For org-scoped models (default):
```prisma
model <ModelName> {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @map("organization_id") @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  // TODO: Add fields here

  @@map("<model_names>")  // plural snake_case table name
}
```

For global models (`--no-rls`):
```prisma
model <ModelName> {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // TODO: Add fields here

  @@map("<model_names>")
}
```

2. **Add the relation** to the Organization model if org-scoped:
```prisma
// In the Organization model, add:
<modelNames> <ModelName>[]
```

3. **Generate the migration**:
```bash
cd /home/dmahaffey/projects/prospector
pnpm --filter @prospector/db exec prisma migrate dev --name add_<model_name>
```

4. **Append RLS policies** to `packages/db/prisma/rls-policies.sql` (skip if `--no-rls`):

```sql
-- <ModelName> RLS
ALTER TABLE <model_names> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <model_names> FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON <model_names>
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON <model_names> TO app_user;
```

5. **Add performance indexes** if relevant:
```sql
-- Add to the migration SQL or rls-policies.sql
CREATE INDEX idx_<model_names>_org ON <model_names>(organization_id);
CREATE INDEX idx_<model_names>_created ON <model_names>(created_at DESC);
```

6. **Regenerate Prisma client**:
```bash
pnpm db:generate
```

7. **Inform the user**:

```
Created:
- Model <ModelName> in packages/db/prisma/schema.prisma
- Migration in packages/db/prisma/migrations/<timestamp>_add_<model_name>/

Updated:
- packages/db/prisma/rls-policies.sql (RLS + FORCE + policy + grants)

Next steps:
1. Run `/db-reset` to apply RLS policies to the dev database
2. Run `/db-reset --test` if you need the test database updated too
3. Consider adding a tRPC router: `/new-router <name>`
4. Consider adding Zod schemas to packages/types/src/
5. Run `pnpm build` to verify TypeScript compiles
```

## Important notes

- Table names use **plural snake_case** (e.g., `ModelName` → `model_names`)
- Always include `organization_id` for org-scoped tables (RLS depends on it)
- FORCE ROW LEVEL SECURITY is **mandatory** — without it, table owners bypass RLS
- The `app_user` GRANT is required for the non-superuser application role
- If adding fields, include appropriate `@map("snake_case")` annotations
