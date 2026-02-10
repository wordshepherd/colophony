# /db-reset

Reset the database schema and apply RLS policies.

## What this skill does

1. Drops and recreates all tables using `prisma db push --force-reset`
2. Applies RLS policies from `packages/db/prisma/rls-policies.sql`
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
cd /home/dmahaffey/projects/prospector/packages/db
DATABASE_URL="postgresql://prospector:password@localhost:5432/prospector" npx prisma db push --force-reset --skip-generate
docker exec prospector-postgres psql -U prospector -d prospector -f /home/dmahaffey/projects/prospector/packages/db/prisma/rls-policies.sql
```

For test database:
```bash
cd /home/dmahaffey/projects/prospector/packages/db
DATABASE_URL="postgresql://test:test@localhost:5433/prospector_test" npx prisma db push --force-reset --skip-generate
docker exec prospector-postgres-test psql -U test -d prospector_test -f /home/dmahaffey/projects/prospector/packages/db/prisma/rls-policies.sql
```

3. Recreate the app_user role (needed for RLS testing):
```bash
docker exec prospector-postgres-test psql -U test -d prospector_test -c "
DROP ROLE IF EXISTS app_user;
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password' NOSUPERUSER NOBYPASSRLS;
GRANT CONNECT ON DATABASE prospector_test TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON FUNCTION current_org_id() TO app_user;
GRANT EXECUTE ON FUNCTION current_user_id() TO app_user;
"
```

4. If `--seed` flag, run seed command (when implemented)

5. Regenerate Prisma client: `pnpm db:generate`

6. Confirm success to user
