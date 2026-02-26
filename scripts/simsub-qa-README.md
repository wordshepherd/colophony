# Sim-Sub (BSAP) Manual QA Test

Validates cross-instance simultaneous submission enforcement end-to-end.

## Prerequisites

- Docker (for second PostgreSQL)
- Node.js with `tsx` available
- Existing dev database seeded (`pnpm db:seed`)

## Steps

### 1. Start infrastructure

```bash
docker compose -f docker-compose.yml -f docker-compose.simsub-qa.yml up -d postgres postgres-b redis
```

This starts:

- `postgres` on port 5432 (Instance A — your normal dev DB)
- `postgres-b` on port 5434 (Instance B — fresh DB)
- `redis` on port 6379 (shared — rate limit keys are domain-scoped)

### 2. Start Instance A

```bash
cd apps/api
FEDERATION_ENABLED=true FEDERATION_DOMAIN=localhost:4000 PORT=4000 \
  DEV_AUTH_BYPASS=true tsx watch src/main.ts
```

### 3. Start Instance B (separate terminal)

```bash
cd apps/api
FEDERATION_ENABLED=true FEDERATION_DOMAIN=localhost:5000 PORT=5000 \
  DATABASE_URL=postgresql://colophony:password@localhost:5434/colophony \
  DATABASE_APP_URL=postgresql://app_user:app_password@localhost:5434/colophony \
  DEV_AUTH_BYPASS=true tsx watch src/main.ts
```

### 4. Run the test script

```bash
pnpm --filter @colophony/types exec tsx ../../scripts/simsub-qa.ts
```

Or if `tsx` is globally installed:

```bash
tsx scripts/simsub-qa.ts
```

## Expected output

```
=== Sim-Sub QA Test Suite ===

[SETUP] Preparing Instance B database...
[SETUP] Instance B migrations applied
[SETUP] Seeding Instance A...
[SETUP] Instance A seeded (org=..., submission=...)
[SETUP] Seeding Instance B...
[SETUP] Instance B seeded (org=..., periods: sim-sub=..., no-sim-sub=...)

[PREFLIGHT] Checking instance health...
[PREFLIGHT] Both instances healthy

[TEST 1] Submit to non-sim-sub period → should succeed (no check)
  ✓ Status 200 (got 200)
  ✓ No sim-sub check recorded (found 0)

[TEST 2] Submit unique manuscript to sim-sub period → should CLEAR
  ✓ Status 200 (got 200)
  ✓ Sim-sub check recorded (found 1)
  ✓ Result is CLEAR (got CLEAR)
  ✓ Remote peer was queried (1 results)
  ✓ Peer domain is localhost:4000 (got localhost:4000)
  ✓ Peer status is checked (got checked)

[TEST 3] Submit duplicate manuscript to sim-sub period → should CONFLICT
  ✓ Status 409 (got 409)
  ✓ Conflict details present (1 conflicts: 0 local, 1 remote)
  → Conflict from: SimSub Test Pub A, period: SimSub QA Period A
  ✓ Remote conflict from localhost:4000 (got localhost:4000)

[TEST 4] Admin override + re-submit → should succeed despite conflict
  ✓ Override granted (status 200)
  ✓ Re-submit succeeded (status 200)
  ✓ Status is SUBMITTED (got SUBMITTED)
  ✓ sim_sub_override is true

=== 15/15 assertions passed ===
```

## Test scenarios

| #   | Scenario                                       | Expected                                 |
| --- | ---------------------------------------------- | ---------------------------------------- |
| 1   | Submit to period with `simSubProhibited=false` | 200 OK, no sim-sub check                 |
| 2   | Submit unique manuscript to sim-sub period     | 200 OK, check result CLEAR, peer queried |
| 3   | Submit duplicate manuscript to sim-sub period  | 409 Conflict, details include Instance A |
| 4   | Admin override + re-submit                     | 200 OK, submitted despite conflict       |

## Manual verification (optional)

After running the script, you can inspect:

```bash
# Instance A audit log for inbound check events
psql -U colophony -d colophony -c "SELECT action, resource_id, created_at FROM audit_events WHERE action LIKE 'simsub%' ORDER BY created_at DESC LIMIT 5;"

# Instance B sim-sub checks table
psql -U colophony -d colophony -h localhost -p 5434 -c "SELECT submission_id, result, remote_results FROM sim_sub_checks ORDER BY created_at DESC;"
```

## Cleanup

The script automatically cleans up Instance A test data. For Instance B:

```bash
docker compose -f docker-compose.yml -f docker-compose.simsub-qa.yml down postgres-b
```

## Environment variables

| Variable         | Default                                                    | Description               |
| ---------------- | ---------------------------------------------------------- | ------------------------- |
| `INSTANCE_A_URL` | `http://localhost:4000`                                    | Instance A base URL       |
| `INSTANCE_B_URL` | `http://localhost:5000`                                    | Instance B base URL       |
| `DB_A_URL`       | `postgresql://colophony:password@localhost:5432/colophony` | Instance A DB (superuser) |
| `DB_B_URL`       | `postgresql://colophony:password@localhost:5434/colophony` | Instance B DB (superuser) |

## Known limitations

- **Trust handshake not tested**: Peers are seeded directly, bypassing the bilateral trust flow. Trust establishment over HTTP requires an `FEDERATION_INSECURE` env var (not yet implemented).
- **Single user identity**: Both instances share `alice@localhost`. In production, DID resolution handles different email domains.
- **No hub path tested**: Hub-first fingerprint lookup requires a running hub instance.
