# Credential Rotation Runbook

Quarterly rotation procedure for all Colophony credentials. Self-managed credentials can be rotated with the included script; external service credentials require manual rotation through each provider's dashboard.

**Schedule:** Quarterly (Jan, Apr, Jul, Oct). Federation keys: annually (see [Federation Keys](#federation-key-rotation)).

---

## Pre-Rotation Checklist

Before rotating any credentials:

- [ ] Verify all services are healthy: `docker compose --env-file .env.prod -f docker-compose.prod.yml ps`
- [ ] Confirm `.env.prod` backup strategy is working (script creates timestamped backups automatically)
- [ ] Schedule a maintenance window — credential rotation requires container restarts
- [ ] Notify team members if applicable

---

## Self-Managed Credentials

These credentials are generated and managed by us. The rotation script handles all of them.

### Quick Start

```bash
# Preview what will change (no modifications)
bash scripts/rotate-secrets.sh --dry-run --all

# Rotate all self-managed credentials
bash scripts/rotate-secrets.sh --all

# Rotate specific credentials
bash scripts/rotate-secrets.sh postgres-password app-user-password

# Restart affected services (printed by the script)
docker compose --env-file .env.prod -f docker-compose.prod.yml restart
```

The script:

1. Backs up `.env.prod` to `.env.prod.backup.YYYYMMDDHHMMSS`
2. Generates new secrets via `openssl rand`
3. Applies database password changes at runtime (`ALTER ROLE`) if the container is running
4. Updates `.env.prod` with new values
5. Prints the restart command — does **not** restart containers automatically

### Per-Credential Details

#### `postgres-password` (PostgreSQL superuser)

- **Env var:** `POSTGRES_PASSWORD`
- **Rotation:** `ALTER ROLE colophony` applied at runtime + `.env.prod` update
- **Affected services:** pgbouncer, api, migrate
- **Verification:**
  ```bash
  docker exec colophony-postgres psql -U colophony -d colophony -c "SELECT 1;"
  ```

#### `app-user-password` (RLS application user)

- **Env var:** `APP_USER_PASSWORD`
- **Rotation:** `ALTER ROLE app_user` applied at runtime + `.env.prod` update
- **Affected services:** pgbouncer, api
- **Verification:**
  ```bash
  docker exec colophony-postgres psql -U app_user -d colophony -c "SELECT current_user;"
  ```
  Note: PgBouncer regenerates `userlist.txt` from env vars at startup — the restart handles this automatically.

#### `redis-password`

- **Env var:** `REDIS_PASSWORD`
- **Rotation:** `.env.prod` update only (applied on restart)
- **Affected services:** redis, api
- **Why no runtime update:** `CONFIG SET requirepass` creates a race condition if Redis restarts before the operator restarts the API. Updating `.env.prod` and restarting both together is safer.
- **Verification:**
  ```bash
  docker exec colophony-redis redis-cli -a "NEW_PASSWORD" ping
  # Expected: PONG
  ```

#### `garage-credentials` (S3-compatible storage)

- **Env vars:** `GARAGE_S3_ACCESS_KEY`, `GARAGE_S3_SECRET_KEY`
- **Rotation:** `.env.prod` update only (applied on restart)
- **Affected services:** garage, garage-setup, api, tusd
- **Notes:** Garage supports runtime key import via admin API. For simplicity, the rotation script updates `.env.prod` and restarts.
- **Verification:**
  ```bash
  curl -s -H "Authorization: Bearer $GARAGE_ADMIN_TOKEN" http://localhost:3903/health
  ```

#### `tus-hook-secret` (upload webhook HMAC)

- **Env var:** `TUS_HOOK_SECRET`
- **Rotation:** `.env.prod` update only (applied on restart)
- **Affected services:** api, tusd
- **Verification:** Upload a test file through the UI after restart.

---

## External Service Credentials

These credentials are issued by third-party providers. Rotate through each provider's dashboard, then update `.env.prod` and restart.

### Stripe

1. Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys)
2. Roll the secret key (Stripe supports rolling — old key remains valid for 24h)
3. Update in `.env.prod`:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY` (if rotating both)
4. For webhook secret: go to Webhooks → select endpoint → Roll secret
   - Update `STRIPE_WEBHOOK_SECRET`
5. Restart: `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api`
6. Verify: trigger a test webhook from Stripe dashboard

### Zitadel (OIDC)

Colophony uses a **public OIDC client** (PKCE flow) — there is no client secret to rotate. The relevant env vars are `ZITADEL_AUTHORITY` and `ZITADEL_CLIENT_ID`, which are identifiers (not secrets).

If your Zitadel instance issues **API keys or PATs** for service accounts, rotate those through the Zitadel Console and update the corresponding env vars. Restart API + Web after any change.

### Email (SMTP)

1. Rotate SMTP credentials through your email provider (Resend, SES, Mailgun, etc.)
2. Update in `.env.prod`:
   - `SMTP_USER`
   - `SMTP_PASS`
3. Restart: `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api`
4. Verify: trigger a test notification

### Documenso (contracts)

1. Rotate API key in Documenso dashboard
2. Update `DOCUMENSO_API_KEY` in `.env.prod`
3. Restart: `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api`

### Inngest (background jobs)

1. Rotate signing key in Inngest dashboard → Environment → Keys
2. Update `INNGEST_SIGNING_KEY` in `.env.prod`
3. Restart: `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api`

### Sentry (error tracking)

1. Rotate DSN in Sentry → Settings → Client Keys
2. Update `SENTRY_DSN` in `.env.prod`
3. Restart: `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api web`

---

## Federation Key Rotation

Federation signing keys (`FEDERATION_PRIVATE_KEY`) are used for HTTP Signatures between instances. Rotating them **breaks existing trust relationships** with peer instances.

**Schedule:** Annually (not quarterly), or immediately if compromised.

**Procedure:**

1. **Coordinate with peers** — notify all trusted instances before rotating
2. Generate a new keypair:
   ```bash
   openssl genpkey -algorithm Ed25519 -out federation-key.pem
   openssl pkey -in federation-key.pem -pubout -out federation-key.pub
   ```
3. Share the new public key with all peer instances
4. Update `FEDERATION_PRIVATE_KEY` in `.env.prod` (base64-encode the PEM)
5. Peers update their trust store with the new public key
6. Restart: `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api`
7. Verify: test a federation operation (e.g., sim-sub check) with a peer

**If compromised:** Rotate immediately, notify peers to revoke the old key, and audit federation logs for unauthorized activity.

---

## Troubleshooting

### Partial Failure Recovery

If the script fails mid-rotation (e.g., `ALTER ROLE` succeeds but `.env.prod` update fails):

1. The database password has already changed but `.env.prod` has the old value
2. Restore from backup: `cp .env.prod.backup.TIMESTAMP .env.prod`
3. Re-run the rotation for the failed credential only
4. If the backup also has the old DB password, manually set it:
   ```bash
   docker exec colophony-postgres psql -U colophony -d colophony -c \
     "ALTER ROLE colophony WITH PASSWORD 'password-from-backup';"
   ```

### PgBouncer Authentication Failures

After rotating `postgres-password` or `app-user-password`, PgBouncer must be restarted to regenerate `userlist.txt`:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml restart pgbouncer
```

If connections still fail, check that the password in `.env.prod` matches what was applied to PostgreSQL:

```bash
# Test direct connection (bypasses PgBouncer)
docker exec colophony-postgres psql -U app_user -d colophony -c "SELECT 1;"
```

### Redis Connection Refused

After rotating `redis-password`, both Redis and the API must be restarted together:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml restart redis api
```

If the API still can't connect, verify the password:

```bash
docker exec colophony-redis redis-cli -a "$(grep REDIS_PASSWORD .env.prod | cut -d= -f2)" ping
```

---

## Quarterly Schedule Template

| Quarter | Date       | Operator | Self-Managed | External | Federation | Notes                      |
| ------- | ---------- | -------- | ------------ | -------- | ---------- | -------------------------- |
| Q2 2026 | 2026-04-XX |          | [ ]          | [ ]      | N/A        |                            |
| Q3 2026 | 2026-07-XX |          | [ ]          | [ ]      | N/A        |                            |
| Q4 2026 | 2026-10-XX |          | [ ]          | [ ]      | [ ]        | Annual federation rotation |
| Q1 2027 | 2027-01-XX |          | [ ]          | [ ]      | N/A        |                            |
