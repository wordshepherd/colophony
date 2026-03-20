FROM postgres:16-alpine

ARG WALG_VERSION=v3.0.3

# Install cron, glibc-compat (WAL-G is glibc-linked), and fetch WAL-G binary
RUN apk add --no-cache bash dcron gcompat \
    && wget -qO /usr/local/bin/wal-g \
       "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-ubuntu-20.04-amd64" \
    && chmod +x /usr/local/bin/wal-g

COPY docker-entrypoint-walg.sh /usr/local/bin/docker-entrypoint-walg.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-walg.sh

COPY crontab /etc/crontabs/walg-crontab

# Embed init-db.sh in the image (bind-mount doesn't work with Coolify)
COPY init-db.sh /docker-entrypoint-initdb.d/init-db.sh
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

ENTRYPOINT ["docker-entrypoint-walg.sh"]
CMD ["postgres"]
