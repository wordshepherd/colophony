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
    -- NOTE: This grants full DML (including DELETE) to ALL future tables.
    -- Tables that should be append-only/immutable need explicit REVOKE below.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

    -- Revoke DELETE on append-only/immutable tables.
    -- ALTER DEFAULT PRIVILEGES grants full DML to all tables; these tables
    -- need explicit REVOKE to enforce immutability. Keep in sync with
    -- migration 0052_revoke_delete_restricted_tables.sql.
    REVOKE DELETE ON "user_keys" FROM app_user;
    REVOKE DELETE ON "trusted_peers" FROM app_user;
    REVOKE DELETE ON "sim_sub_checks" FROM app_user;
    REVOKE DELETE ON "inbound_transfers" FROM app_user;
    REVOKE DELETE ON "documenso_webhook_events" FROM app_user;

    -- Create audit_writer role for tamper-proof audit trail
    -- NOLOGIN: only used as SECURITY DEFINER function owner, never connects directly
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audit_writer') THEN
            CREATE ROLE audit_writer WITH NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
    END
    \$\$;

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
