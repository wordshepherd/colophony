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

Colophony uses **5 separate Coolify resources** (one per service group) to enable independent deploys and eliminate Traefik stale routing issues.

### Prerequisites: Create shared network

SSH to the VPS and run:

```bash
bash scripts/coolify-network-setup.sh
```

This creates the `colophony-net` Docker network shared by all 5 resources.

### Create 5 resources

In Coolify dashboard, create a new **Project** (e.g., "Colophony Staging"), then add 5 **Docker Compose** resources:

| Resource       | Compose path             | Domain (Coolify UI)      | Notes                               |
| -------------- | ------------------------ | ------------------------ | ----------------------------------- |
| **Data**       | `coolify/data.yml`       | —                        | postgres, pgbouncer, redis, minio   |
| **App**        | `coolify/app.yml`        | —                        | api, web (most frequently deployed) |
| **Gateway**    | `coolify/gateway.yml`    | `staging.yourdomain.com` | nginx — set Domain here only        |
| **Uploads**    | `coolify/uploads.yml`    | —                        | tusd, clamav                        |
| **Monitoring** | `coolify/monitoring.yml` | —                        | prometheus, grafana, loki, etc.     |

For each resource:

1. Connect your Git repository
2. Set the compose file path (see table above)
3. Set the environment file to `.env.staging`
4. **Gateway only:** Set the "Domains" field to your staging domain (for Traefik routing)

## 2. Environment Variables

Each Coolify resource needs its own subset of environment variables. The Data resource needs DB/Redis/MinIO credentials. The App resource needs the full set (API + Web config). The Gateway resource needs none. The Uploads resource needs MinIO credentials. The Monitoring resource needs Grafana/Slack config.

In each resource's settings, add variables from `.env.staging.example`. Key ones:

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

Deploy resources in dependency order:

1. **Data** — deploy first, wait for all healthchecks green (postgres, pgbouncer, redis, minio)
2. **App** — deploy after data is healthy. The API entrypoint runs migrations + RLS verification + MinIO bucket setup
3. **Uploads** — deploy after app is healthy (tusd needs minio + api)
4. **Gateway** — deploy last. Traefik picks up nginx for routing
5. **Monitoring** — deploy anytime (independent)

Watch build logs in each Coolify resource. Wait for all healthchecks to go green.

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

### Webhook-based deployment (recommended)

Each Coolify resource has its own webhook URL. Add all 5 to GitHub Actions secrets:

| GitHub Secret                | Coolify Resource      |
| ---------------------------- | --------------------- |
| `COOLIFY_WEBHOOK_DATA`       | Data                  |
| `COOLIFY_WEBHOOK_APP`        | App                   |
| `COOLIFY_WEBHOOK_GATEWAY`    | Gateway               |
| `COOLIFY_WEBHOOK_UPLOADS`    | Uploads               |
| `COOLIFY_WEBHOOK_MONITORING` | Monitoring            |
| `COOLIFY_API_TOKEN`          | Bearer token (shared) |

The deploy workflow (`.github/workflows/deploy.yml`) uses **smart detection** — it diffs changed files since the last successful deploy (`vars.LAST_DEPLOYED_SHA`) and only redeploys affected groups. Manual dispatch supports selecting specific groups.

### CLI deployment

```bash
# Deploy all groups
bash scripts/coolify-deploy.sh --group all --health-url https://staging.yourdomain.com

# Deploy app group only (most common)
bash scripts/coolify-deploy.sh --group app --health-url https://staging.yourdomain.com
```

### Coolify Git integration (alternative)

Enable **Auto Deploy** on each Coolify resource individually. Not recommended — all resources would redeploy on every push, losing the benefit of the split.

## 8. Compose Architecture

```
Internet → Traefik (Coolify, TLS) → [Gateway] nginx (:80) → [App] api (:4000), web (:3000)
                                                                ↓          ↘ [Uploads] tusd (:1080), clamav
                                                          [Data] pgbouncer → postgres
                                                                 redis, minio
                                                          [Monitoring] prometheus, grafana, loki, ...
```

The deployment uses **5 separate Coolify resources** (`coolify/*.yml`), each a standalone compose file sharing the `colophony-net` external Docker network. Only the Gateway resource also joins the `coolify` network (for Traefik service discovery).

Key differences from the production compose (`docker-compose.prod.yml`):

- No host port bindings on nginx (Traefik routes traffic)
- PgBouncer with lower pool sizes (10/100/25 vs 20/200/50)
- Migrations run inline in the API entrypoint (Coolify crash-loops one-shot containers)
- MinIO bucket setup inlined in the API entrypoint (same reason)
- Debug logging by default (`LOG_LEVEL: ${LOG_LEVEL:-debug}`)
- Split into 5 resources for independent deploy cycles

## 9. Backups (Future)

Backups are disabled by default in staging. To enable WAL-G backups:

```env
BACKUP_S3_PREFIX=s3://your-bucket/colophony-staging
BACKUP_S3_ACCESS_KEY=...
BACKUP_S3_SECRET_KEY=...
BACKUP_S3_ENDPOINT=https://...  # for non-AWS providers
```

See [docs/deployment.md — Backup & Restore](deployment.md#backup--restore-wal-g) for full documentation.

## 10. Monitoring Access

Grafana is accessible at `https://<your-domain>/grafana` (proxied through nginx).

**Credentials:** `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from Coolify environment variables. Change the admin password after first login.

**Pre-provisioned dashboards:**

- **API Metrics** — HTTP request rates, latency percentiles, error rates, BullMQ queue depth, DB pool stats
- **Logs Exploration** — Loki log search across all containers (Pino JSON parsing for API logs)

**Data sources** (auto-provisioned):

- Prometheus (`http://prometheus:9090`)
- Loki (`http://loki:3100`)

Grafana's health endpoint (`/grafana/api/health`) is checked by the uptime workflow and post-deploy verification. It does not require authentication.

## 11. AlertManager Slack Notifications

Set `SLACK_WEBHOOK_URL` in Coolify environment variables to enable alert delivery to Slack.

**Setup:**

1. Create an Incoming Webhook in your Slack workspace (Apps → Incoming Webhooks)
2. Set `SLACK_WEBHOOK_URL` to the webhook URL (format: `https://hooks.slack.com/services/T.../B.../xxx`)
3. Alerts route to the channel configured in `docker/alertmanager/alertmanager.yml`

**If `SLACK_WEBHOOK_URL` is not set:** AlertManager starts with a placeholder URL and alerts silently fail to deliver.

**To verify configuration:**

```bash
ssh <staging-host> docker exec colophony-alertmanager wget -qO- http://localhost:9093/api/v2/status
```

**Active alert rules** (defined in `docker/prometheus/alert-rules.yml`):

- HighErrorRate (5xx >5% for 5m) — critical
- QueueDepthCritical (>100 jobs for 10m) — warning
- DBPoolExhaustion (waiting clients >0 for 5m) — warning
- HealthEndpointDown (unreachable for 2m) — critical
- HighRequestLatency (p99 >5s for 5m) — warning
- BullMQJobFailureSpike (>10% failure rate for 5m) — warning

## Migration from Single Resource

If migrating from the deprecated monolithic `docker-compose.coolify.yml`:

1. SSH to host: `bash scripts/coolify-network-setup.sh` to create `colophony-net`
2. Identify current volume names: `docker volume ls | grep staging`
3. Create 5 Coolify resources (see Section 1), each pointing to its compose file
4. Copy env vars from old resource to appropriate new resources
5. Deploy in order: Data → (wait healthy) → App → Uploads → Gateway → Monitoring
6. If old volume names don't match `colophony_staging_*`, either update `name:` in compose files to match, or copy data: `docker run --rm -v old_vol:/from -v new_vol:/to alpine cp -a /from/. /to/`
7. Verify with smoke tests: `bash scripts/smoke-test.sh https://staging.yourdomain.com`
8. Decommission old single resource in Coolify UI
9. Update GitHub secrets: replace `COOLIFY_WEBHOOK_URL` with 5 group-specific URLs

## Troubleshooting

### Build fails in Coolify

Check that each resource's compose file path matches: `coolify/data.yml`, `coolify/app.yml`, etc.

### Service can't resolve hostname across groups

Verify the `colophony-net` network exists (`docker network ls`) and that both resources have it declared as `external: true` in their compose files.

### 502 Bad Gateway / maintenance page after deploy

During a redeploy, nginx starts immediately and serves a maintenance page while backends initialize. The API can take up to 2 minutes on first deploy (migrations, RLS verification, optional seeding). The maintenance page auto-refreshes every 30 seconds.

nginx's Docker healthcheck uses `/nginx-health` — a local endpoint that does not depend on backend availability. Coolify uses this health status for Traefik routing decisions.

**If the maintenance page persists beyond 3 minutes:**

1. Check API health: Coolify dashboard → api service → logs
2. Check if `init-prod.sh` is still running (migrations, RLS verification)
3. Verify database connectivity: check pgbouncer and postgres service logs

**If you see raw 502 errors (not the maintenance page):**

1. nginx itself may be down — check nginx service logs in Coolify
2. Verify nginx container is healthy: `docker ps | grep nginx`
3. Check that the nginx image built successfully (maintenance.html must be embedded)

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
