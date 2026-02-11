---
name: test-rls
description: Run RLS (Row-Level Security) integration tests to verify tenant isolation.
---

# /test-rls

Run RLS (Row-Level Security) integration tests to verify tenant isolation.

## What this skill does

1. Ensures the test database is set up correctly
2. Runs all RLS-related integration tests
3. Reports any isolation failures

## Usage

```
/test-rls           # Run all RLS tests
/test-rls --verbose # Run with verbose output
```

## Instructions for Claude

When the user invokes `/test-rls`:

1. **Verify test database is ready**:

```bash
docker exec colophony-postgres-test psql -U test -d colophony_test -c "SELECT 1" 2>/dev/null
```

If this fails, tell the user to run `docker compose up -d`.

2. **Run the RLS tests**:

```bash
pnpm --filter @colophony/api test -- --testPathPattern=rls
```

3. **Interpret results**:
   - If all tests pass: Confirm RLS isolation is working correctly
   - If tests fail:
     - Check if it's a setup issue (database not running, app_user role missing)
     - Check if it's an actual RLS policy issue (pgPolicy in schema)
     - Provide specific guidance on what failed

4. **Common issues to check**:
   - `app_user` role doesn't exist → Run `/db-reset --test`
   - RLS policies not applied → Check if `enableRLS()` is on the table and pgPolicy entries exist in schema
   - Wrong connection string → Verify test config uses app_user
   - Missing pgPolicy → Check `packages/db/src/schema/<table>.ts` for policy definitions
   - Verify policies in DB: `SELECT * FROM pg_policies WHERE tablename = '<table_name>'`

## Why RLS tests matter

These tests are CRITICAL for security. They verify that:

- Users in Org A cannot see Org B's data
- Users cannot create data in other organizations
- All tenant tables enforce isolation via pgPolicy

If these tests fail, there is a potential data leakage vulnerability.

## RLS in Drizzle vs Prisma

In Colophony v2, RLS policies are defined **in the schema** using `pgPolicy()` rather than in a separate SQL file. This means:

- Policies are co-located with table definitions
- Migrations automatically include RLS setup
- No separate `rls-policies.sql` to maintain
- `enableRLS()` on the table handles ENABLE + FORCE ROW LEVEL SECURITY
