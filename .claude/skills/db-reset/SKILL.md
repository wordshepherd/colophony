---
name: db-reset
description: Reset the database schema using Drizzle migrations and apply RLS policies.
---

# /db-reset

Reset the database schema using Drizzle migrations and apply RLS policies.

## What this skill does

1. Drops and recreates all tables using Drizzle
2. Runs all migrations (which include pgPolicy RLS definitions)
3. Creates the `app_user` role for RLS enforcement (if not exists)
4. Optionally seeds test data

## Usage

```
/db-reset           # Reset dev database
/db-reset --test    # Reset test database
/db-reset --seed    # Reset and seed with sample data
```

## Instructions for Claude

When the user invokes `/db-reset`:

1. Determine which database to reset (dev or test based on flags)
2. Run the reset commands:

For dev database:

```bash
cd /home/dmahaffey/projects/colophony/packages/db

# Drop all tables and re-run migrations
pnpm drizzle-kit push --force

# Or for a clean slate:
docker exec colophony-postgres psql -U colophony -d colophony -c "
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO colophony;
"
pnpm db:migrate
```

For test database:

```bash
cd /home/dmahaffey/projects/colophony/packages/db

# Drop and recreate test schema
docker exec colophony-postgres-test psql -U test -d colophony_test -c "
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO test;
"

# Run migrations against test database
DATABASE_URL="postgresql://test:test@localhost:5433/colophony_test" pnpm db:migrate
```

3. Recreate the app_user role (needed for RLS testing):

```bash
docker exec colophony-postgres-test psql -U test -d colophony_test -c "
DROP ROLE IF EXISTS app_user;
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password' NOSUPERUSER NOBYPASSRLS;
GRANT CONNECT ON DATABASE colophony_test TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
"
```

4. If `--seed` flag, run seed command (when implemented)

5. Confirm success to user

## Notes

- In Colophony v2, RLS policies are defined in Drizzle schema files via `pgPolicy()` and `enableRLS()`
- Migrations automatically include all RLS setup — no separate `rls-policies.sql` needed
- The `app_user` role must still be created manually (it's a database role, not a table)
- After reset, verify RLS is active:
  ```bash
  docker exec colophony-postgres psql -U colophony -d colophony -c \
    "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relrowsecurity = true;"
  ```
