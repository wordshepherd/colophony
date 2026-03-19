#!/bin/sh
set -eu

# PgBouncer entrypoint — generates config from environment variables.
# Secrets stay in env vars, never committed to repo.

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "ERROR: POSTGRES_PASSWORD is required" >&2
  exit 1
fi

if [ -z "${APP_USER_PASSWORD:-}" ]; then
  echo "ERROR: APP_USER_PASSWORD is required" >&2
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-colophony}"
POSTGRES_DB="${POSTGRES_DB:-colophony}"
PGBOUNCER_DEFAULT_POOL_SIZE="${PGBOUNCER_DEFAULT_POOL_SIZE:-20}"
PGBOUNCER_MAX_CLIENT_CONN="${PGBOUNCER_MAX_CLIENT_CONN:-200}"
PGBOUNCER_MAX_DB_CONNECTIONS="${PGBOUNCER_MAX_DB_CONNECTIONS:-50}"

mkdir -p /etc/pgbouncer

# Generate userlist with plaintext passwords (PgBouncer performs SCRAM auth to PostgreSQL)
cat > /etc/pgbouncer/userlist.txt <<EOF
"${POSTGRES_USER}" "${POSTGRES_PASSWORD}"
"app_user" "${APP_USER_PASSWORD}"
EOF

# Generate pgbouncer.ini
cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
* = host=${PGBOUNCER_DB_HOST:-postgres} port=${PGBOUNCER_DB_PORT:-5432}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction

default_pool_size = ${PGBOUNCER_DEFAULT_POOL_SIZE}
max_client_conn = ${PGBOUNCER_MAX_CLIENT_CONN}
max_db_connections = ${PGBOUNCER_MAX_DB_CONNECTIONS}
reserve_pool_size = 5
reserve_pool_timeout = 3

server_idle_timeout = 600
server_lifetime = 3600

ignore_startup_parameters = extra_float_digits

admin_users = ${POSTGRES_USER}
stats_users = ${POSTGRES_USER}
EOF

echo "PgBouncer config generated (pool_mode=transaction, max_client_conn=${PGBOUNCER_MAX_CLIENT_CONN}, max_db_connections=${PGBOUNCER_MAX_DB_CONNECTIONS})"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
