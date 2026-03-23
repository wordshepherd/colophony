# Deployment Guide

> **Deploying with Coolify?** See [docs/coolify-deployment.md](coolify-deployment.md) for the Coolify + Hetzner guide (recommended for staging).

## System Requirements

| Resource       | Minimum               | Recommended                |
| -------------- | --------------------- | -------------------------- |
| CPU            | 2 cores               | 4 cores                    |
| RAM            | 2 GB                  | 4 GB                       |
| Disk           | 20 GB                 | 50 GB+                     |
| Docker         | 24+                   | Latest                     |
| Docker Compose | v2                    | Latest                     |
| OS             | Any Linux with Docker | Ubuntu 22.04+ / Debian 12+ |

**Additional requirements:**

- `openssl` (for secret generation during installation)
- Port 80 available (configurable via `HTTP_PORT`)

## Quick Start

```bash
git clone https://github.com/wordshepherd/colophony.git
cd colophony
bash scripts/install.sh
```

The installation script will:

1. Check prerequisites (Docker, Compose, openssl)
2. Generate cryptographic secrets
3. Prompt for domain and optional Stripe/email configuration
4. Write `.env.prod` with secure permissions
5. Build and start all services
6. Wait for health checks to pass

## Manual Setup

If you prefer to configure manually instead of using the install script:

### 1. Create environment file

```bash
cp .env.prod.example .env.prod
```

### 2. Generate secrets

Replace each `CHANGE_ME_*` placeholder:

```bash
# PostgreSQL passwords
openssl rand -base64 48 | tr -d '=/+'  # POSTGRES_PASSWORD
openssl rand -base64 48 | tr -d '=/+'  # APP_USER_PASSWORD

# Redis password
openssl rand -base64 48 | tr -d '=/+'  # REDIS_PASSWORD

# MinIO credentials
openssl rand -hex 16                   # MINIO_ROOT_USER
openssl rand -base64 48 | tr -d '=/+'  # MINIO_ROOT_PASSWORD

# tusd webhook secret
openssl rand -hex 32                   # TUS_HOOK_SECRET
```

### 3. Edit configuration

```bash
# Set your domain
DOMAIN=submissions.example.com

# Optionally configure Stripe and email
# See .env.prod.example for all options
```

### 4. Set file permissions

```bash
chmod 600 .env.prod
```

### 5. Build and start

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 6. Verify

```bash
# Check all services are healthy
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

# Check migration logs
docker compose --env-file .env.prod -f docker-compose.prod.yml logs migrate

# Test health endpoint
curl http://localhost/health
```

## Environment Variables

### Required

| Variable              | Description                                | Example                   |
| --------------------- | ------------------------------------------ | ------------------------- |
| `DOMAIN`              | Your domain name                           | `submissions.example.com` |
| `POSTGRES_PASSWORD`   | PostgreSQL superuser password              | (generated)               |
| `APP_USER_PASSWORD`   | App database user password (non-superuser) | (generated)               |
| `REDIS_PASSWORD`      | Redis password                             | (generated)               |
| `MINIO_ROOT_USER`     | MinIO access key                           | (generated)               |
| `MINIO_ROOT_PASSWORD` | MinIO secret key                           | (generated)               |
| `TUS_HOOK_SECRET`     | tusd webhook auth secret                   | (generated)               |

### Optional

| Variable                 | Description                                 | Default     |
| ------------------------ | ------------------------------------------- | ----------- |
| `POSTGRES_USER`          | PostgreSQL superuser name                   | `colophony` |
| `POSTGRES_DB`            | Database name                               | `colophony` |
| `HTTP_PORT`              | Nginx listen port                           | `80`        |
| `RATE_LIMIT_DEFAULT_MAX` | General rate limit (req/min)                | `60`        |
| `RATE_LIMIT_AUTH_MAX`    | Auth rate limit (req/min)                   | `200`       |
| `ZITADEL_AUTHORITY`      | Zitadel issuer URL                          | (empty)     |
| `ZITADEL_CLIENT_ID`      | Zitadel OIDC client ID                      | (empty)     |
| `STRIPE_SECRET_KEY`      | Stripe API key                              | (empty)     |
| `STRIPE_WEBHOOK_SECRET`  | Stripe webhook secret                       | (empty)     |
| `EMAIL_PROVIDER`         | Email provider (`smtp`, `sendgrid`, `none`) | `none`      |
| `SMTP_HOST`              | SMTP server hostname                        | (empty)     |
| `SMTP_PORT`              | SMTP server port                            | `587`       |
| `SMTP_USER`              | SMTP username                               | (empty)     |
| `SMTP_PASS`              | SMTP password                               | (empty)     |
| `SMTP_FROM`              | SMTP sender address                         | (empty)     |
| `FEDERATION_ENABLED`     | Enable federation features                  | `false`     |
| `SENTRY_DSN`             | Sentry error tracking DSN                   | (empty)     |
| `METRICS_ENABLED`        | Enable Prometheus `/metrics`                | `false`     |

## Architecture

```
                   ┌─────────┐
  Internet ──────> │  nginx  │ :80
                   └────┬────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼────┐
    │    web    │ │    api    │ │  tusd   │
    │  (Next.js)│ │ (Fastify) │ │(uploads)│
    │   :3000   │ │   :4000   │ │  :1080  │
    └───────────┘ └──┬──┬──┬──┘ └────┬────┘
                     │  │  │         │
              ┌──────┘  │  └──────┐  │
              │         │         │  │
        ┌─────▼──┐ ┌────▼───┐ ┌──▼──▼──┐
        │postgres│ │ redis  │ │ minio  │
        │ :5432  │ │ :6379  │ │ :9000  │
        └────────┘ └────────┘ └────────┘
```

**Services:**

- **nginx** — Reverse proxy, TLS termination, rate limiting
- **web** — Next.js frontend (standalone output)
- **api** — Fastify API with tRPC + REST + GraphQL, background jobs (BullMQ)
- **tusd** — Resumable file upload server (tus protocol)
- **postgres** — PostgreSQL 16 with Row-Level Security
- **redis** — Sessions, cache, BullMQ job queue
- **minio** — S3-compatible file storage
- **clamav** — Virus scanning (optional, `--profile full`)
- **migrate** — One-shot: runs Drizzle migrations + RLS policies
- **zitadel** — Zitadel auth service (OIDC provider, dev compose only — production uses external Zitadel)
- **inngest** — Inngest dev server (dev compose only — production uses Inngest Cloud or self-hosted)

## SSL/TLS with Let's Encrypt

### Option 1: Certbot standalone (simplest)

```bash
# Install certbot
apt install certbot

# Get certificate (stop nginx first)
docker compose --env-file .env.prod -f docker-compose.prod.yml stop nginx
certbot certonly --standalone -d your-domain.com
docker compose --env-file .env.prod -f docker-compose.prod.yml start nginx
```

### Option 2: Nginx SSL configuration

After obtaining certificates, update `nginx/nginx.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... existing location blocks ...
}
```

Mount the certificates volume in `docker-compose.prod.yml`:

```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

### Certificate renewal

```bash
# Auto-renew with cron
echo "0 3 * * * certbot renew --pre-hook 'docker compose -f /path/to/docker-compose.prod.yml stop nginx' --post-hook 'docker compose -f /path/to/docker-compose.prod.yml start nginx'" | crontab -
```

## Backup & Restore (WAL-G)

Colophony uses [WAL-G](https://github.com/wal-g/wal-g) for continuous PostgreSQL backups:

- **WAL archival** — every committed transaction is streamed to S3 in near-real-time
- **Daily base backups** — full backup at 3:00 AM UTC via cron inside the postgres container
- **Retention** — old backups pruned at 4:30 AM UTC (default: keep 7 full backups)
- **PITR** — point-in-time recovery to any moment between backups

### Configuration

Add `BACKUP_*` variables to `.env.prod` (see `docker/postgres/wal-g.env.example` for full reference):

| Variable                     | Required | Default     | Description                                            |
| ---------------------------- | -------- | ----------- | ------------------------------------------------------ |
| `BACKUP_S3_PREFIX`           | Yes      | —           | S3 bucket + path (e.g., `s3://colophony-backups/prod`) |
| `BACKUP_S3_ACCESS_KEY`       | Yes      | —           | S3 access key                                          |
| `BACKUP_S3_SECRET_KEY`       | Yes      | —           | S3 secret key                                          |
| `BACKUP_S3_REGION`           | No       | `us-east-1` | AWS region                                             |
| `BACKUP_S3_ENDPOINT`         | No       | —           | Custom endpoint (Backblaze, Wasabi, MinIO)             |
| `BACKUP_S3_FORCE_PATH_STYLE` | No       | `false`     | `true` for MinIO                                       |
| `BACKUP_COMPRESSION`         | No       | `lz4`       | Compression: lz4, lzma, zstd, brotli                   |
| `BACKUP_RETAIN_DAYS`         | No       | `7`         | Number of full backups to retain                       |

Provider examples (AWS S3, Backblaze B2, Wasabi, local MinIO) are in `docker/postgres/wal-g.env.example`.

Backups are disabled if `BACKUP_S3_PREFIX` is not set (entrypoint skips cron startup).

### Manual backup

```bash
bash scripts/backup-db.sh            # Push a full base backup now
bash scripts/backup-db.sh --dry-run  # Preview without executing
```

### Verify backups

```bash
bash scripts/verify-backup.sh        # List backups + WAL chain check
bash scripts/verify-backup.sh --json # Machine-readable output
```

### Restore

```bash
# Restore from latest backup
bash scripts/restore-backup.sh --latest --confirm

# Point-in-time recovery (restore to a specific moment)
bash scripts/restore-backup.sh --latest --pitr "2026-03-19 14:00:00 UTC" --confirm

# Restore a specific named backup
bash scripts/restore-backup.sh base_000000010000000000000005 --confirm

# Preview what would happen
bash scripts/restore-backup.sh --latest --dry-run
```

The restore script stops services, fetches the backup, configures recovery, restarts PostgreSQL, verifies RLS, and brings application services back up.

### Legacy volume backup (fallback)

For environments without WAL-G, volume snapshots still work as a fallback:

```bash
# Stop, backup volumes, restart
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker run --rm -v colophony_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz -C /data .
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## RLS Verification

Row-Level Security is verified automatically during every deploy (structural checks only).

### Automatic (every deploy)

The `migrate` service runs `verify-rls.sh --structural-only` after migrations. This checks:

- All tenant tables have RLS enabled + forced
- `app_user` and `audit_writer` roles have correct permissions
- Every RLS table has at least one policy
- GRANT/REVOKE enforcement on restricted tables

### Full verification (manual)

Run the complete behavioral test suite for go-live and after schema changes:

```bash
# Against local dev database
DATABASE_URL=postgresql://colophony:colophony@localhost:5432/colophony \
  bash scripts/verify-rls.sh

# Against production (via Docker)
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  bash /app/scripts/verify-rls.sh --verbose
```

Full verification adds data isolation tests (cross-org visibility, cross-org INSERT rejection) and permission restriction tests (append-only tables, audit immutability). All behavioral tests run inside `BEGIN; ... ROLLBACK;` — zero data footprint.

## Updating

```bash
# Pull latest code
git pull

# Rebuild and restart (zero-downtime for stateless services)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# The migrate service runs automatically on start to apply any new migrations
```

For major updates, check the release notes for breaking changes and required migration steps.

## Virus Scanning

ClamAV is optional and runs under the `full` profile:

```bash
# Start with virus scanning enabled
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile full up -d

# ClamAV takes 1-2 minutes to load virus definitions on first start
# Check status:
docker compose --env-file .env.prod -f docker-compose.prod.yml logs clamav
```

Without ClamAV, uploaded files skip virus scanning and are treated as clean.

## Monitoring

### Health endpoint

```bash
curl http://localhost/health
# Returns: {"status":"ok","timestamp":"2026-02-10T12:00:00.000Z"}
```

### Logs

```bash
# All services
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f

# Specific service
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail 100 api
```

### Service status

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

### Resource usage

```bash
docker stats --no-stream
```

## Troubleshooting

### Services won't start

```bash
# Check logs for errors
docker compose --env-file .env.prod -f docker-compose.prod.yml logs

# Check if .env.prod exists and has correct values
cat .env.prod

# Rebuild from scratch
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### Migration failed

```bash
# Check migration logs
docker compose --env-file .env.prod -f docker-compose.prod.yml logs migrate

# Re-run migration manually
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate
```

### Database connection refused

```bash
# Check if postgres is healthy
docker compose --env-file .env.prod -f docker-compose.prod.yml ps postgres

# Check postgres logs
docker compose --env-file .env.prod -f docker-compose.prod.yml logs postgres

# Verify credentials
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  psql -U colophony -c "SELECT 1;"
```

### Port conflict

```bash
# Change the HTTP port in .env.prod
HTTP_PORT=8080

# Restart nginx
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d nginx
```

### Reset everything (destructive)

```bash
# WARNING: This deletes ALL data
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### Check RLS is enforced

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  psql -U colophony -c "
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname IN ('submissions', 'payments', 'audit_events');"
```

### Check app_user is not superuser

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  psql -U colophony -c "SELECT usename, usesuper FROM pg_user WHERE usename = 'app_user';"
# Expected: app_user | f
```

## Release Process (Tag-Based)

### Environments Overview

| Environment | Compose file               | Trigger                    | URL                 |
| ----------- | -------------------------- | -------------------------- | ------------------- |
| Development | docker-compose.yml         | Manual (`pnpm dev`)        | localhost:3000/4000 |
| Staging     | docker-compose.coolify.yml | Auto on merge to `main`    | staging domain      |
| Production  | docker-compose.prod.yml    | Manual `workflow_dispatch` | production domain   |

### Staging (Automatic)

1. PR merged to `main`
2. CI pipeline runs (all jobs must pass)
3. Deploy workflow triggers — Coolify webhook fires
4. Coolify pulls latest `main`, rebuilds images, starts services
5. `init-prod.sh` runs migrations + RLS verification
6. Health check + smoke test verify deployment

### Production Release

#### Pre-release

1. Verify staging is healthy and has been validated
2. Run through [release checklist](release-checklist.md) on staging
3. Review migrations for destructive changes — if any, prepare rollback SQL

#### Tag and deploy

4. Tag: `git tag v<major>.<minor>.<patch>`
5. Push: `git push origin v<major>.<minor>.<patch>`
6. Create GitHub Release with changelog
7. Actions → Deploy → Run workflow → production → enter tag

#### Post-deploy

8. Health check + smoke test run automatically in workflow
9. Monitor Sentry for 15-30 minutes
10. Spot-check one critical flow on production

### Rollback

#### Code rollback (redeploy previous tag)

1. Actions → Deploy → Run workflow → production → enter previous tag
2. Previous tag skips new migrations (Drizzle is additive)
3. Smoke test verifies rollback

#### When rollback is NOT safe

- The release added a migration that drops columns or changes types
- The previous code depends on schema that no longer exists
- In these cases: fix forward (hotfix branch) or restore from WAL-G backup

#### Database restore (disaster recovery)

See `scripts/restore-backup.sh` — supports PITR (point-in-time recovery).

### Migration Safety

| Safe (rollback-friendly)      | Unsafe (needs rollback SQL) |
| ----------------------------- | --------------------------- |
| ADD COLUMN (nullable/default) | DROP COLUMN                 |
| CREATE TABLE                  | ALTER TYPE (enum changes)   |
| CREATE INDEX CONCURRENTLY     | DROP TABLE                  |
| ADD pgPolicy                  | Rename column/table         |

For unsafe migrations: write `rollback-NNNN.sql` alongside the migration in `packages/db/migrations/` and test on staging before production deploy.

### Docker Image Pruning

On Coolify: verify Docker Cleanup is enabled in Settings.

On the production server, add a weekly cron:

```
0 5 * * 0 docker image prune -f --filter "until=168h"
```

### Environment Differences

| Aspect                 | Staging (Coolify)         | Production                     |
| ---------------------- | ------------------------- | ------------------------------ |
| PgBouncer pool size    | 10                        | 20                             |
| Max client connections | 100                       | 200                            |
| Postgres memory        | 512M                      | 1G                             |
| pg_stat_statements     | No                        | Yes                            |
| Log level              | debug                     | info                           |
| Sentry environment     | staging                   | production                     |
| Container names        | Auto (Coolify)            | Explicit (colophony-\*)        |
| One-shot containers    | Inlined in API entrypoint | Separate migrate + minio-setup |
