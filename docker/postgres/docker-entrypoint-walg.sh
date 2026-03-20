#!/bin/bash
# WAL-G wrapper entrypoint — exports env for cron, starts crond, delegates to postgres entrypoint.
set -e

# Export WAL-G/AWS/backup env vars so cron jobs can source them.
# Alpine cron doesn't inherit container environment.
env | grep -E '^(AWS_|WALG_|POSTGRES_|BACKUP_|PG)' > /env.sh
chmod 600 /env.sh

# Only start cron if WAL-G is configured (WALG_S3_PREFIX must be set)
if [ -n "$WALG_S3_PREFIX" ]; then
    # Install crontab for postgres user
    crontab -u postgres /etc/crontabs/walg-crontab
    crond -b -l 8
    echo "walg-entrypoint: cron started for WAL-G backups (prefix: $WALG_S3_PREFIX)"
else
    echo "walg-entrypoint: WALG_S3_PREFIX not set — backups disabled"
fi

# Delegate to the official postgres entrypoint
exec docker-entrypoint.sh "$@"
