# Plan: CLI Tooling Scripts

## Context

The monitoring stack (Prometheus, Grafana, AlertManager, Loki, Promtail) shipped in PRs #324-#325. The last session's handoff identified CLI tooling scripts as the next deliverable — 6 bash scripts that give developers and operators quick access to monitoring data, logs, and deployment controls without navigating multiple UIs.

## Design Decisions

**Inline boilerplate (not shared lib):** Each script duplicates color constants and `usage()`. The project has 15+ scripts and none share a lib file. Consistency > DRY for 30 lines of boilerplate.

**Pure bash for all scripts:** Even `zitadel-admin.sh` uses bash+curl+jq rather than TypeScript. The existing TS Zitadel scripts are for provisioning (write ops); these are read-only queries where jq suffices.

**Container resolution:** `coolify-logs.sh` uses `docker compose ps --format` to resolve service names to container names (not hardcoded `colophony-` prefix). Coolify compose doesn't set `container_name`, so prefix assumption is unsound for remote/Coolify use. Fall back to `docker ps --filter` with service label matching.

## Files to Create

### 1. `scripts/webhook-health.sh` (~120 lines)

Query `GET /webhooks/health` and display formatted provider status.

**Flags:** `--url <base-url>` (default `http://localhost:4000`), `--json`, `--quiet`, `-h`

**Output format:**

```
Provider     Status       Last Event            Freshness
zitadel      ✓ healthy    2026-03-23 14:30      2m ago
stripe       ⚠ stale      2026-03-22 01:00      1d 13h ago
documenso    ❌ unknown    —                     —
```

**Exit code:** 1 if any provider is stale/unknown (CI-friendly).

**Dependencies:** `curl`, `jq`

### 2. `scripts/grafana-query.sh` (~180 lines)

Query Loki for logs and AlertManager for firing alerts.

**Subcommands:**

- `logs --query '<LogQL>' --since 1h --limit 100 --loki-url <url>`
- `alerts --alertmanager-url <url>` (default `http://localhost:9093`; Grafana and AlertManager are separate services on different ports)

**Loki API:** `GET /loki/api/v1/query_range?query=<encoded>&start=<ns>&limit=N&direction=backward`

- URL-encode query via `jq -sRr @uri`
- Parse `.data.result[].values[]` (each is `[timestamp, line]`)
- Colorize log level: red=error, yellow=warn, cyan=info

**Alerts:** `GET http://localhost:9093/api/v2/alerts` → filter firing → format table.

**Flags:** `--json` on both subcommands, `-h`

**Dependencies:** `curl`, `jq`

### 3. `scripts/coolify-logs.sh` (~160 lines)

Tail and search Docker container logs, locally or via SSH.

**Subcommands:**

- `tail <service> [--lines N] [--follow] [--all] [--host <ssh-host>]`
- `search <pattern> [--service <name>] [--since 1h] [--host <ssh-host>]`

**Container resolution:** `resolve_container()` uses `docker compose ps --format '{{.Name}}' --filter service=<name>` to find the actual container name for a compose service. Falls back to `docker ps --filter name=<name>` for non-compose setups. Does not assume `colophony-` prefix (Coolify compose omits `container_name`).

**Remote:** `run_cmd()` helper wraps commands in `ssh $HOST "..."` when `--host` is set.

**Dependencies:** `docker` (local), `ssh` (remote)

### 4. `scripts/sentry-issues.sh` (~130 lines)

List recent Sentry issues via the Sentry API.

**Flags:** `--limit N` (default 10), `--resolved`, `--json`, `--url <sentry-url>` (default `https://sentry.io`), `-h`

**Env vars (required):** `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

**API:** `GET /api/0/projects/{org}/{project}/issues/?limit=N&query=is:unresolved`

- Auth: `Authorization: Bearer $SENTRY_AUTH_TOKEN`
- Format: level (colorized), title (truncated), count, last seen (relative), link

**Dependencies:** `curl`, `jq`

### 5. `scripts/zitadel-admin.sh` (~200 lines)

Common Zitadel admin queries via the Management/Admin API.

**Subcommands:** `status`, `users`, `orgs`, `sessions`

**Flags:** `--authority <url>` (default `$ZITADEL_AUTHORITY`), `--token <token>` (default `$ZITADEL_SERVICE_TOKEN`, falls back to `.docker/zitadel/machinekey/admin.pat`), `--limit N` (default 20), `--json`, `-h`

**API endpoints:**

- `status`: `GET /debug/healthz`
- `users`: `POST /v2/users` with `{"queries":[],"limit":N}` (matches `zitadel-helpers.ts` payload format)
- `orgs`: `POST /admin/v1/orgs/_search` with `{"queries":[],"limit":N}`
- `sessions`: `POST /v2/sessions/search` with `{"queries":[],"limit":N}`

**Note:** Validate exact payload format against Zitadel v2 API docs during implementation — existing TS helpers use `queries` array, not `query` object.

**Dependencies:** `curl`, `jq`

### 6. `scripts/coolify-deploy.sh` (~140 lines)

Trigger a Coolify deployment from CLI, mirroring the GitHub Actions pattern.

**Flags:** `--no-wait`, `--yes`/`-y`, `--health-url <url>`, `--skip-smoke`, `-h`

**Env vars (required):** `COOLIFY_WEBHOOK_URL`, `COOLIFY_API_TOKEN`

**Logic (mirrors `deploy.yml` lines 121-152):**

1. Confirm unless `--yes`
2. `curl -X GET -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" "${COOLIFY_WEBHOOK_URL}"` — check HTTP 200/201
3. Sleep 30s
4. Poll health endpoint (10 attempts × 15s)
5. Run `smoke-test.sh` unless `--skip-smoke`

**Dependencies:** `curl`

## Files to Modify

### `.env.example`

Fold new vars into existing sections (not a new top-level block):

- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` → existing Monitoring/Sentry section
- `COOLIFY_WEBHOOK_URL`, `COOLIFY_API_TOKEN` → existing Deployment section (or Monitoring if no deploy section)
- `ZITADEL_SERVICE_TOKEN` → existing Zitadel/Auth section

### `.env.prod.example`

Same vars, same sections.

### `.env.staging.example`

Same vars, same sections.

### `CLAUDE.md`

Add to Key File Locations table:

- `scripts/webhook-health.sh`, `scripts/grafana-query.sh`, `scripts/coolify-logs.sh`
- `scripts/sentry-issues.sh`, `scripts/zitadel-admin.sh`, `scripts/coolify-deploy.sh`

Add CLI usage examples to "Starting Development" section after monitoring block.

## Files That Should NOT Change

- `apps/api/src/webhooks/webhook-health.route.ts` — consumed, not modified
- `apps/api/src/config/env.ts` — no new API-side env vars needed
- `docker-compose.yml` / `docker-compose.prod.yml` — no Docker changes
- `scripts/smoke-test.sh` — consumed by `coolify-deploy.sh`, not modified
- `.github/workflows/deploy.yml` — scripts complement, not replace
- `package.json` — no new npm dependencies

## Implementation Sequence

1. `webhook-health.sh` — simplest, validates boilerplate pattern
2. `grafana-query.sh` — Loki API, log formatting
3. `coolify-logs.sh` — Docker logs, SSH remote pattern
4. `sentry-issues.sh` — external API with auth
5. `zitadel-admin.sh` — most complex (4 subcommands)
6. `coolify-deploy.sh` — depends on smoke-test.sh integration
7. `.env.example` / `.env.prod.example` / `.env.staging.example` updates
8. `CLAUDE.md` updates

## Verification

1. `bash -n scripts/<each>.sh` — syntax check all 6
2. `bash scripts/<each>.sh --help` — exits 1 and prints usage (matches existing `usage()` convention in `rotate-secrets.sh`)
3. `webhook-health.sh` — test against running dev API; test `--json`, `--quiet`; test with API down
4. `grafana-query.sh logs` — test with `--profile monitoring` up
5. `grafana-query.sh alerts` — test against AlertManager API
6. `coolify-logs.sh tail api` — test against running dev containers
7. `sentry-issues.sh` — test with valid `SENTRY_AUTH_TOKEN`; test without token (error msg)
8. `zitadel-admin.sh status` — test against local Zitadel
9. `coolify-deploy.sh` — test confirmation prompt with 'n'; test `--yes` flag

## Codex Review (2026-03-23)

**Verdict:** Issues found (0 critical, 3 important, 2 suggestions — all addressed above)

- Renamed `--grafana-url` → `--alertmanager-url` on `alerts` subcommand (AlertManager is port 9093, not Grafana 3001)
- Replaced `colophony-` prefix assumption with `docker compose ps` service name resolution (Coolify compose omits `container_name`)
- Fixed Zitadel API payload to use `queries` array (matching `zitadel-helpers.ts` pattern)
- Folded env vars into existing `.env.example` sections instead of new top-level block
- Fixed `--help` exit code to 1 (matching existing `usage()` convention)

## Reference Files

- `scripts/rotate-secrets.sh` — primary bash pattern reference
- `scripts/smoke-test.sh` — curl + health check pattern, consumed by coolify-deploy.sh
- `.github/workflows/deploy.yml:121-152` — Coolify webhook trigger pattern
- `apps/api/src/webhooks/webhook-health.route.ts` — response contract
