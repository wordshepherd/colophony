# Deployment Guide

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB+ |
| Docker | 24+ | Latest |
| Docker Compose | v2 | Latest |
| OS | Any Linux with Docker | Ubuntu 22.04+ / Debian 12+ |

**Additional requirements:**
- `openssl` (for secret generation during installation)
- Port 80 available (configurable via `HTTP_PORT`)

## Quick Start

```bash
git clone https://github.com/your-org/prospector.git
cd prospector
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

# JWT secret (64+ characters)
openssl rand -base64 64 | tr -d '=/+'  # JWT_SECRET

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

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | `submissions.example.com` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | (generated) |
| `APP_USER_PASSWORD` | App database user password (non-superuser) | (generated) |
| `JWT_SECRET` | JWT signing secret (64+ chars) | (generated) |
| `REDIS_PASSWORD` | Redis password | (generated) |
| `MINIO_ROOT_USER` | MinIO access key | (generated) |
| `MINIO_ROOT_PASSWORD` | MinIO secret key | (generated) |
| `TUS_HOOK_SECRET` | tusd webhook auth secret | (generated) |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL superuser name | `prospector` |
| `POSTGRES_DB` | Database name | `prospector` |
| `HTTP_PORT` | Nginx listen port | `80` |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token TTL | `7d` |
| `RATE_LIMIT_DEFAULT_MAX` | General rate limit (req/min) | `100` |
| `RATE_LIMIT_AUTH_MAX` | Auth rate limit (req/min) | `20` |
| `STRIPE_SECRET_KEY` | Stripe API key | (empty) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | (empty) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | (empty) |
| `SMTP_HOST` | SMTP server hostname | (empty) |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | (empty) |
| `SMTP_PASSWORD` | SMTP password | (empty) |
| `EMAIL_FROM` | Sender email address | `noreply@{DOMAIN}` |

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
    │  (Next.js)│ │ (NestJS)  │ │(uploads)│
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
- **api** — NestJS API with tRPC, background jobs
- **tusd** — Resumable file upload server (tus protocol)
- **postgres** — PostgreSQL 16 with Row-Level Security
- **redis** — Sessions, cache, BullMQ job queue
- **minio** — S3-compatible file storage
- **clamav** — Virus scanning (optional, `--profile full`)
- **migrate** — One-shot: runs Prisma migrations + RLS policies

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

## Backup & Restore

### Database backup

```bash
# Backup
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  pg_dump -U prospector prospector > backup_$(date +%Y%m%d).sql

# Restore
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  psql -U prospector prospector < backup_20260210.sql
```

### Full volume backup

```bash
# Stop services
docker compose --env-file .env.prod -f docker-compose.prod.yml down

# Backup volumes
docker run --rm \
  -v prospector_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz -C /data .

docker run --rm \
  -v prospector_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio_data.tar.gz -C /data .

docker run --rm \
  -v prospector_redis_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/redis_data.tar.gz -C /data .

# Start services
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

### Restore from volume backup

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down

docker run --rm \
  -v prospector_postgres_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/postgres_data.tar.gz -C /data"

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

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
  psql -U prospector -c "SELECT 1;"
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
  psql -U prospector -c "
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname IN ('submissions', 'payments', 'audit_events');"
```

### Check app_user is not superuser

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  psql -U prospector -c "SELECT usename, usesuper FROM pg_user WHERE usename = 'app_user';"
# Expected: app_user | f
```
