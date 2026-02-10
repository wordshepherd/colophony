#!/bin/bash
# Creates the non-superuser app role for RLS enforcement
# This script runs automatically when PostgreSQL container starts

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create non-superuser role for application (required for RLS)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
            CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_USER_PASSWORD:-app_password}' NOSUPERUSER NOBYPASSRLS;
        END IF;
    END
    \$\$;

    -- Grant permissions
    GRANT CONNECT ON DATABASE $POSTGRES_DB TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

    -- Grant default permissions for future tables
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

    -- Verify role is not superuser
    SELECT usename, usesuper,
           CASE WHEN usesuper THEN '❌ ERROR: Role is superuser!'
                ELSE '✅ Role is NOT superuser (RLS will work)'
           END as rls_status
    FROM pg_user WHERE usename = 'app_user';
EOSQL

echo "✅ app_user role created successfully"
