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
docker exec prospector-postgres-test psql -U test -d prospector_test -c "SELECT 1" 2>/dev/null
```

If this fails, tell the user to run `docker-compose up -d`.

2. **Run the RLS tests**:
```bash
pnpm --filter @prospector/api test -- --testPathPattern=rls
```

3. **Interpret results**:
   - If all tests pass: Confirm RLS isolation is working correctly
   - If tests fail:
     - Check if it's a setup issue (database not running, app_user role missing)
     - Check if it's an actual RLS policy issue
     - Provide specific guidance on what failed

4. **Common issues to check**:
   - `app_user` role doesn't exist → Run `/db-reset --test`
   - RLS policies not applied → Check `SELECT * FROM pg_policies`
   - Wrong connection string → Verify `test-context.ts` uses app_user

## Why RLS tests matter

These tests are CRITICAL for security. They verify that:
- Users in Org A cannot see Org B's data
- Users cannot create data in other organizations
- All tenant tables enforce isolation

If these tests fail, there is a potential data leakage vulnerability.
