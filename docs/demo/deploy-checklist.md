# Demo Site Deployment Checklist

One-time setup steps for deploying the demo profile to a server.

## Prerequisites

- Staging/production server running with `docker-compose.prod.yml`
- SSH access to the server
- DNS control for the target domain

## 1. DNS

Add an A record for `demo.<domain>` pointing to the same IP as the main domain.

```
demo.staging.colophony.pub  →  <staging-vps-ip>
```

Caddy handles TLS automatically. No certificate setup needed.

## 2. Create Demo Database

SSH into the server and run the init script:

```bash
cd /opt/colophony  # or STAGING_APP_DIR
docker compose -f docker-compose.prod.yml --env-file .env.staging \
  exec postgres bash /scripts/init-demo-db.sh
```

This creates:

- `colophony_demo` database
- `app_user` role with RLS-scoped privileges
- Default privilege grants on public schema

## 3. Create S3 Buckets

Create demo-specific buckets in Garage (or your S3 provider):

```bash
# Via Garage CLI (inside container)
docker compose -f docker-compose.prod.yml --env-file .env.staging \
  exec garage /garage bucket create demo-submissions
docker compose -f docker-compose.prod.yml --env-file .env.staging \
  exec garage /garage bucket create demo-quarantine

# Grant access to the API key
docker compose -f docker-compose.prod.yml --env-file .env.staging \
  exec garage /garage bucket allow demo-submissions --read --write --key <key-id>
docker compose -f docker-compose.prod.yml --env-file .env.staging \
  exec garage /garage bucket allow demo-quarantine --read --write --key <key-id>
```

## 4. Deploy with Demo Profile

The GitHub Actions workflow (`deploy.yml`) already includes `--profile demo` for staging.
On manual deploy or first setup:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.staging --profile demo build
docker compose -f docker-compose.prod.yml --env-file .env.staging --profile demo up -d
```

## 5. Verify

```bash
# Check demo services are running
docker compose -f docker-compose.prod.yml --env-file .env.staging --profile demo ps | grep demo

# Health check
curl -sf https://demo.<domain>/health

# Demo login endpoint
curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"role":"writer"}' \
  https://demo.<domain>/v1/public/demo/login
```

## 6. Schedule Automatic Reset (Optional)

Add a cron job to reset demo data periodically:

```bash
crontab -e
# Add:
0 */4 * * * cd /opt/colophony && ./scripts/demo-reset.sh >> /var/log/demo-reset.log 2>&1
```

This drops and recreates the demo schema + seed data every 4 hours.

## Troubleshooting

| Symptom                         | Cause                     | Fix                                                      |
| ------------------------------- | ------------------------- | -------------------------------------------------------- |
| `demo-migrate` exits with error | Demo DB doesn't exist     | Run step 2                                               |
| 503 on demo login               | Seed data missing         | Run `docker compose --profile demo restart demo-migrate` |
| Caddy 502 on demo subdomain     | Demo services not running | Check `docker compose --profile demo ps`                 |
| S3 access denied                | Demo buckets not created  | Run step 3                                               |
