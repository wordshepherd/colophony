---
name: smoke-test
description: Validate infrastructure changes locally — Docker Compose syntax, Garage S3, shell scripts.
---

# /smoke-test

Validate infrastructure changes locally before pushing to CI.

## What this skill does

1. Validates Docker Compose file syntax (dev, prod, e2e overlay)
2. Checks shell script syntax in `docker/` and `scripts/`
3. Validates Garage config (`garage.toml`)
4. Optionally starts Garage in a throwaway container and tests the full S3 flow
5. Reports pass/fail with actionable errors

## Usage

```
/smoke-test              # Full: compose + config + Garage S3 (requires Docker)
/smoke-test compose      # Fast: compose + config + shell syntax only (no Docker daemon needed)
/smoke-test garage       # Garage S3 flow only (requires Docker)
```

## Instructions for Claude

When the user invokes `/smoke-test`, perform these steps in order.

### Step 1: Parse mode

- No argument → **full** mode
- `compose` → **compose** mode
- `garage` → **garage** mode

### Step 2: Compose & config validation (all modes except `garage`)

Run these checks sequentially, reporting each result:

**a. Docker Compose files:**

```bash
docker compose -f docker-compose.yml config --quiet 2>&1
docker compose -f docker-compose.prod.yml config --quiet 2>&1
docker compose -f docker-compose.yml -f docker-compose.e2e.yml config --quiet 2>&1
```

Report each as PASS or FAIL. Prod compose warnings about unset env vars (e.g., `GARAGE_RPC_SECRET`) are expected — only report actual parse errors.

**b. Shell script syntax:**

Use the Glob tool to find all `*.sh` files in `docker/` and `scripts/`, then run `bash -n` on each:

```bash
bash -n <file>
```

Report any syntax errors. If `shellcheck` is available (`command -v shellcheck`), also run `shellcheck -S error <file>` for deeper analysis.

**c. Garage config:**

Validate `docker/garage/garage.toml` has required sections by checking for these strings:

- `metadata_dir`
- `data_dir`
- `rpc_bind_addr`
- `[s3_api]`
- `[admin]`
- `api_bind_addr` (should appear twice — under s3_api and admin)

Use the Grep tool to check each. Report any missing entries.

**d. CI workflow YAML:**

```bash
docker compose version > /dev/null 2>&1 && echo "Docker CLI available" || echo "Docker CLI not available"
```

If Docker CLI is available, validate the CI workflow references valid Docker images by checking that pinned images in `.github/workflows/ci.yml` don't use `:latest`:

Use Grep to search for `:latest` in `.github/workflows/ci.yml`. Report any found.

### Step 3: Garage S3 smoke test (full and garage modes only)

**Pre-check:**

```bash
docker info > /dev/null 2>&1 || { echo "Docker daemon not running — skipping Garage test"; }
```

If Docker is not running, skip this step and report it.

**a. Check for port conflicts:**

```bash
lsof -ti :3900 2>/dev/null && echo "CONFLICT:3900" || true
lsof -ti :3901 2>/dev/null && echo "CONFLICT:3901" || true
lsof -ti :3903 2>/dev/null && echo "CONFLICT:3903" || true
```

If any conflicts exist, report them and skip the Garage test. Suggest stopping conflicting services first.

**b. Start throwaway Garage container:**

```bash
docker run -d --name smoke-garage --network host \
  -e GARAGE_RPC_SECRET=$(openssl rand -hex 32) \
  -e GARAGE_ADMIN_TOKEN=smoke-test-token \
  -v $(pwd)/docker/garage/garage.toml:/etc/garage.toml:ro \
  -v $(pwd)/docker/garage/start-garage.sh:/start-garage.sh:ro \
  --entrypoint /bin/sh \
  dxflrs/garage:v2.2.0 /start-garage.sh
```

Wait for health (max 30s):

```bash
timeout 30 bash -c 'until curl -sf http://localhost:3903/health > /dev/null 2>&1; do sleep 1; done'
```

If timeout, report FAIL, show container logs (`docker logs smoke-garage 2>&1 | tail -20`), clean up, and stop.

**c. Test key import via admin API:**

```bash
curl -sf -X POST \
  -H "Authorization: Bearer smoke-test-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke","accessKeyId":"GKdeadbeef12345678abcdef00","secretAccessKey":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}' \
  http://localhost:3903/v2/ImportKey
```

Report PASS or FAIL with HTTP status.

**d. Test bucket creation:**

```bash
BUCKET_ID=$(curl -sf -X POST \
  -H "Authorization: Bearer smoke-test-token" \
  -H "Content-Type: application/json" \
  -d '{"globalAlias":"smoke-test-bucket"}' \
  http://localhost:3903/v2/CreateBucket | jq -r '.id')
```

Report PASS or FAIL.

**e. Test bucket access grant:**

```bash
curl -sf -X POST \
  -H "Authorization: Bearer smoke-test-token" \
  -H "Content-Type: application/json" \
  -d "{\"bucketId\":\"$BUCKET_ID\",\"accessKeyId\":\"GKdeadbeef12345678abcdef00\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
  http://localhost:3903/v2/AllowBucketKey
```

Report PASS or FAIL.

**f. Test S3 put + get:**

```bash
# Put object
curl -sf -X PUT \
  -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
  -H "x-amz-date: $(date -u +%Y%m%dT%H%M%SZ)" \
  --aws-sigv4 "aws:amz:us-east-1:s3" \
  --user "GKdeadbeef12345678abcdef00:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  -d "smoke-test-content" \
  "http://localhost:3900/smoke-test-bucket/smoke-test.txt"

# Get object
CONTENT=$(curl -sf \
  --aws-sigv4 "aws:amz:us-east-1:s3" \
  --user "GKdeadbeef12345678abcdef00:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  "http://localhost:3900/smoke-test-bucket/smoke-test.txt")

[ "$CONTENT" = "smoke-test-content" ] && echo "S3 round-trip: PASS" || echo "S3 round-trip: FAIL (got: $CONTENT)"
```

Note: `--aws-sigv4` requires curl 7.75+. If not available, use `docker run --rm amazon/aws-cli` instead:

```bash
docker run --rm --network host \
  -e AWS_ACCESS_KEY_ID=GKdeadbeef12345678abcdef00 \
  -e AWS_SECRET_ACCESS_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli --endpoint-url http://localhost:3900 \
  s3 cp - s3://smoke-test-bucket/smoke-test.txt --content-type text/plain <<< "smoke-test-content"
```

**g. Cleanup (ALWAYS — even on failure):**

```bash
docker rm -f smoke-garage 2>/dev/null
```

### Step 4: Report results

Print a summary:

```
## Smoke Test Results

### Compose & Config
- docker-compose.yml:      PASS
- docker-compose.prod.yml: PASS
- docker-compose.e2e.yml:  PASS
- Shell scripts:           PASS (N files checked)
- garage.toml:             PASS
- No :latest tags in CI:   PASS

### Garage S3 (skipped if Docker unavailable)
- Container startup:       PASS
- Health check:            PASS
- Key import:              PASS
- Bucket creation:         PASS
- Bucket access grant:     PASS
- S3 round-trip:           PASS

Overall: PASS (N/N checks passed)
```

If any check failed, highlight it and suggest fixes.

## Important notes

- The Garage container uses `--network host` and ports 3900/3901/3903 — check for conflicts first
- Always clean up the `smoke-garage` container, even on failure
- The `compose` mode works without a running Docker daemon — `docker compose config` only parses YAML
- Shell syntax check (`bash -n`) catches parse errors but not runtime bugs
- The S3 round-trip test uses `--aws-sigv4` (curl 7.75+) — fall back to `amazon/aws-cli` Docker image if unavailable
- Do not modify any project files — this is a read-only validation skill
