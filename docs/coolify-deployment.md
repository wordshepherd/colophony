# Coolify + Hetzner Deployment Guide

Deploy Colophony to a Hetzner VPS managed by [Coolify](https://coolify.io) (self-hosted PaaS). Coolify handles Git integration, TLS via Traefik, and zero-downtime deploys.

> **See also:** [docs/deployment.md](deployment.md) for manual Docker Compose deployment without Coolify.

## Prerequisites

| Requirement       | Details                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| **VPS**           | Hetzner CX31 (4 vCPU, 8 GB RAM) or equivalent. ~EUR 7.50/mo                  |
| **Coolify**       | Installed on the VPS ([install guide](https://coolify.io/docs/installation)) |
| **DNS**           | A record pointing your domain to the VPS IP                                  |
| **Zitadel Cloud** | Free tier at [zitadel.cloud](https://zitadel.cloud) (25k MAU)                |
| **Inngest Cloud** | Free tier at [inngest.com](https://inngest.com) (5k events/mo)               |

## 1. Coolify Project Setup

1. In Coolify dashboard, create a new **Project** (e.g., "Colophony Staging")
2. Add a new **Resource** → **Docker Compose**
3. Connect your Git repository
4. Set the **Docker Compose file paths** to:
   ```
   docker-compose.staging.yml;docker-compose.coolify.yml
   ```
5. Set the **Environment file** to `.env.staging`

## 2. Environment Variables

In the Coolify resource settings, add all variables from `.env.staging.example`. Key ones:

### Required — Infrastructure

```env
DOMAIN=staging.yourdomain.com

POSTGRES_USER=colophony
POSTGRES_PASSWORD=<generate: openssl rand -base64 48 | tr -d '=/+'>
POSTGRES_DB=colophony_staging
APP_USER_PASSWORD=<generate: openssl rand -base64 48 | tr -d '=/+'>

REDIS_PASSWORD=<generate: openssl rand -base64 48 | tr -d '=/+'>

MINIO_ROOT_USER=<generate: openssl rand -hex 16>
MINIO_ROOT_PASSWORD=<generate: openssl rand -base64 48 | tr -d '=/+'>

TUS_HOOK_SECRET=<generate: openssl rand -hex 32>
```

### Required — Auth (Zitadel Cloud)

```env
ZITADEL_AUTHORITY=https://your-instance.zitadel.cloud
ZITADEL_CLIENT_ID=<from Zitadel OIDC app>
ZITADEL_WEBHOOK_SECRET=<generate: openssl rand -hex 32>

NEXT_PUBLIC_ZITADEL_AUTHORITY=https://your-instance.zitadel.cloud
NEXT_PUBLIC_ZITADEL_CLIENT_ID=<same as ZITADEL_CLIENT_ID>
```

### Required — Background Jobs (Inngest Cloud)

```env
INNGEST_EVENT_KEY=<from Inngest dashboard>
INNGEST_SIGNING_KEY=<from Inngest dashboard>
```

### Optional — Payments

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Optional — Email

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_FROM=noreply@staging.yourdomain.com
```

### Optional — Monitoring

```env
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=staging
METRICS_ENABLED=true
```

## 3. Zitadel Cloud Setup

1. Create a new project in Zitadel Cloud
2. Add a **Web Application** (OIDC):
   - Redirect URIs: `https://staging.yourdomain.com/auth/callback`
   - Post-logout redirect: `https://staging.yourdomain.com`
   - Auth method: PKCE (no client secret)
   - Grant types: Authorization Code
3. Copy the **Client ID** → set as `ZITADEL_CLIENT_ID` and `NEXT_PUBLIC_ZITADEL_CLIENT_ID`
4. Copy the **Issuer URL** → set as `ZITADEL_AUTHORITY` and `NEXT_PUBLIC_ZITADEL_AUTHORITY`
5. Create a **Webhook** (Actions → Targets):
   - URL: `https://staging.yourdomain.com/webhooks/zitadel`
   - Events: user.created, user.updated, user.deactivated, user.reactivated, user.deleted
   - Set the signing secret → `ZITADEL_WEBHOOK_SECRET`

## 4. Inngest Cloud Setup

1. Create an app at [app.inngest.com](https://app.inngest.com)
2. Set the **Serve URL** to: `https://staging.yourdomain.com/api/inngest`
3. Copy **Event Key** → `INNGEST_EVENT_KEY`
4. Copy **Signing Key** → `INNGEST_SIGNING_KEY`

## 5. DNS + TLS

1. Point your domain to the Hetzner VPS IP:
   ```
   staging.yourdomain.com  A  <VPS_IP>
   ```
2. Coolify's Traefik automatically provisions Let's Encrypt TLS certificates
3. No nginx TLS config needed — Traefik terminates TLS, nginx receives plain HTTP

## 6. First Deployment

1. Click **Deploy** in the Coolify dashboard (or push to configured branch)
2. Watch the build logs in Coolify
3. The `migrate` service runs automatically (Drizzle migrations + RLS verification)
4. Wait for all healthchecks to go green

### Post-deployment smoke test

```bash
bash scripts/smoke-test.sh https://staging.yourdomain.com
```

### Manual verification checklist

- [ ] OIDC login: click Sign In → Zitadel login page → redirect back with session
- [ ] Create an organization
- [ ] Create a submission form
- [ ] Upload a file (test tus protocol)
- [ ] Submit a test submission

## 7. Auto-Deploy

### Option A: Coolify webhook (recommended)

Coolify provides a webhook URL for each resource. Add it to GitHub Actions:

1. In Coolify, copy the **Webhook URL** from resource settings
2. In GitHub repo → Settings → Secrets, add `COOLIFY_WEBHOOK_URL`
3. The deploy workflow (`.github/workflows/deploy.yml`) triggers Coolify via this webhook

### Option B: Coolify Git integration

Enable **Auto Deploy** in Coolify resource settings. Coolify polls the repo or uses a GitHub webhook to deploy on push to the configured branch.

## 8. Compose Architecture

```
Internet → Traefik (Coolify, TLS) → nginx (:80) → api/web/tusd
                                                     ↓
                                              pgbouncer → postgres
                                              redis, minio
```

The Coolify overlay (`docker-compose.coolify.yml`) on top of `docker-compose.staging.yml`:

- Removes host port bindings from nginx (Traefik routes traffic)
- Adds Traefik labels for service discovery
- Adds PgBouncer (required for RLS `SET LOCAL` in transaction pooling mode)
- Overrides URLs to use `https://` (Traefik terminates TLS)
- Removes `container_name` directives (Coolify manages naming)

## 9. Backups (Future)

Backups are disabled by default in staging. To enable WAL-G backups:

```env
BACKUP_S3_PREFIX=s3://your-bucket/colophony-staging
BACKUP_S3_ACCESS_KEY=...
BACKUP_S3_SECRET_KEY=...
BACKUP_S3_ENDPOINT=https://...  # for non-AWS providers
```

See [docs/deployment.md — Backup & Restore](deployment.md#backup--restore-wal-g) for full documentation.

## Troubleshooting

### Build fails in Coolify

Check that the compose file paths are exactly: `docker-compose.staging.yml;docker-compose.coolify.yml` (semicolon-separated, no spaces).

### 502 Bad Gateway after deploy

Services may still be starting. Wait 30-60 seconds for healthchecks. Check Coolify logs for the `api` service.

### OIDC redirect fails

Verify that:

- `NEXT_PUBLIC_ZITADEL_AUTHORITY` and `NEXT_PUBLIC_ZITADEL_CLIENT_ID` are set (these are build-time args — rebuild after changing)
- Redirect URI in Zitadel matches exactly: `https://staging.yourdomain.com/auth/callback`
- Zitadel Cloud issuer URL has no trailing slash

### Database connection errors

The `migrate` service uses a direct connection (port 5432). The `api` service routes through PgBouncer (port 6432). Check PgBouncer logs if the API can't connect but migrations succeed.

### TLS certificate not provisioning

- Verify DNS A record points to the VPS IP
- Check Traefik logs in Coolify: Settings → Proxy → Logs
- Ensure port 443 is not blocked by firewall

### Containers restarting (OOM)

Check `docker stats` on the VPS. The CX31 has 8 GB RAM. If running the `full` profile (with ClamAV), consider upgrading to CX41.
