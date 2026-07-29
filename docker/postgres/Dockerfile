FROM postgres:16-alpine

ARG WALG_VERSION=v3.0.3

# Install cron, glibc-compat (WAL-G is glibc-linked), and fetch WAL-G binary
RUN apk add --no-cache bash dcron gcompat \
    && wget -qO /usr/local/bin/wal-g \
       "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-ubuntu-20.04-amd64" \
    && chmod +x /usr/local/bin/wal-g

COPY docker/postgres/docker-entrypoint-walg.sh /usr/local/bin/docker-entrypoint-walg.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-walg.sh

COPY docker/postgres/crontab /etc/crontabs/walg-crontab

# Embed init-db.sh in the image (bind-mount doesn't work with Coolify).
# Copied from scripts/ rather than kept as a second copy here — the two used to
# be maintained by hand and nothing enforced that they matched.
COPY scripts/init-db.sh /docker-entrypoint-initdb.d/init-db.sh
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

# init-db.sh sources this. Deliberately NOT in /docker-entrypoint-initdb.d/ —
# postgres executes every .sql it finds there, which would run the manifest a
# second time, standalone.
COPY packages/db/privileges.sql /opt/colophony/privileges.sql

ENTRYPOINT ["docker-entrypoint-walg.sh"]
CMD ["postgres"]
