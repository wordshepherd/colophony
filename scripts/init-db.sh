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

    -- Create audit_writer role for tamper-proof audit trail
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audit_writer') THEN
            CREATE ROLE audit_writer WITH LOGIN PASSWORD '${AUDIT_USER_PASSWORD:-audit_password}' NOSUPERUSER NOBYPASSRLS;
        END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE $POSTGRES_DB TO audit_writer;
    GRANT USAGE ON SCHEMA public TO audit_writer;

    -- Verify roles are not superusers
    SELECT usename, usesuper,
           CASE WHEN usesuper THEN '❌ ERROR: Role is superuser!'
                ELSE '✅ Role is NOT superuser (RLS will work)'
           END as rls_status
    FROM pg_user WHERE usename IN ('app_user', 'audit_writer');
EOSQL

echo "✅ app_user and audit_writer roles created successfully"

# --- Zitadel database and user ---
# Zitadel needs its own database and a limited-privilege user.
# The Zitadel container uses ADMIN credentials to bootstrap the schema,
# then operates as this user.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'zitadel') THEN
            CREATE ROLE zitadel WITH LOGIN PASSWORD '${ZITADEL_DB_PASSWORD:-zitadel_password}' NOSUPERUSER NOCREATEDB;
        END IF;
    END
    \$\$;
EOSQL

# Create the zitadel database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE zitadel OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zitadel')\gexec

    GRANT ALL PRIVILEGES ON DATABASE zitadel TO zitadel;
EOSQL

echo "✅ zitadel database and role created successfully"
