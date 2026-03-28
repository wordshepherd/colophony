# Plan: Automate Zitadel Actions v2 Executions Setup

## Context

The Zitadel webhook handler (`apps/api/src/webhooks/zitadel.webhook.ts`) already handles all 6 user lifecycle events. However, Zitadel-side configuration (creating **targets** and **executions** via the Zitadel Actions v2 API) is currently done manually through the Zitadel UI. Only `user.human.added` has an execution configured on staging.

The remaining events need executions: `user.human.changed`, `user.human.deactivated`, `user.human.reactivated`, `user.human.removed`, `user.human.email.verified`.

This should be automated in the existing `pnpm zitadel:setup` script so that local dev, E2E, and staging environments all get consistent webhook configuration.

## Files to Modify

### 1. `docker-compose.yml` — Add `extra_hosts` to Zitadel service

The Zitadel container needs `host.docker.internal` to reach the host-network API (same pattern as tusd at line 151). Add:

```yaml
zitadel:
  ...
  extra_hosts:
    - 'host.docker.internal:host-gateway'
```

### 2. `scripts/zitadel-helpers.ts` — Add target + execution helpers

**`findOrCreateTarget(token, name, url, timeout?)`**

- Search: `POST /v2/targets/search` with `targetNameQuery` (exact match)
- If found: return `{ targetId, signingKey: null }` (Zitadel only returns signingKey on creation)
- If not found: `POST /v2/targets` with `{ name, restWebhook: { interruptOnError: false }, endpoint: url, timeout: timeout || "10s" }`
- Return `{ targetId, signingKey }` — signingKey is the HMAC secret for `ZITADEL-Signature` verification

**`setExecution(token, eventType, targetId)`**

- `PUT /v2/executions` with `{ condition: { request: { event: eventType } }, targets: [{ target: targetId }] }`
- Idempotent — PUT replaces any existing execution for the same condition

**`WEBHOOK_EVENT_TYPES` constant** — array of all 6 event types:

```typescript
export const WEBHOOK_EVENT_TYPES = [
  "user.human.added",
  "user.human.changed",
  "user.human.deactivated",
  "user.human.reactivated",
  "user.human.removed",
  "user.human.email.verified",
] as const;
```

### 3. `scripts/setup-zitadel-dev.ts` — Wire webhook setup into dev provisioning

Add after step 5 (OIDC app setup), before .env patching:

```
Step 6: Set up webhook target + executions
```

- Target name: `colophony-dev-webhook`
- Target URL: `http://host.docker.internal:4000/webhooks/zitadel` (reaches host API from Docker)
- Call `findOrCreateTarget()`, then `setExecution()` for all 6 event types
- **Signing key handling:**
  - If target was **created** (signingKey returned): patch `ZITADEL_WEBHOOK_SECRET` into `apps/api/.env`
  - If target **already exists** (signingKey is null): check if `ZITADEL_WEBHOOK_SECRET` is already set in `apps/api/.env`. If missing, warn user and offer to delete+recreate: log `"Target already exists but ZITADEL_WEBHOOK_SECRET not found in .env. Delete the target in Zitadel UI and rerun, or set the secret manually."`

### 4. `scripts/setup-zitadel-e2e.ts` — Wire webhook setup into E2E provisioning

Same pattern but with E2E-specific values:

- Target name: `colophony-e2e-webhook`
- Target URL: `http://host.docker.internal:4010/webhooks/zitadel` (E2E API port per `playwright.config.ts:27`)
- Write `ZITADEL_WEBHOOK_SECRET` to the E2E config JSON file (or to the API .env, same as dev — E2E loads from API .env via `dotenv`)

### Files that should NOT change

- `apps/api/src/webhooks/zitadel.webhook.ts` — handler is complete
- `packages/auth-client/src/` — types and signature verification are complete
- `apps/api/src/config/env.ts` — `ZITADEL_WEBHOOK_SECRET` already defined

## Codex Review Notes

- **Critical (addressed):** Target URL must use `host.docker.internal` not `localhost` — Zitadel runs in Docker. Also need `extra_hosts` mapping on the Zitadel service in `docker-compose.yml`.
- **Important (addressed):** E2E uses port 4010, not 4000. Separate target with correct port.
- **Important (addressed):** Existing target without signingKey needs explicit handling — warn + fail rather than silently skip.
- **Suggestion (addressed):** Use `pnpm --filter @colophony/api test:webhooks` for verification.

## Verification

1. `docker compose --profile auth up -d` — start Zitadel (now with `extra_hosts`)
2. `pnpm zitadel:setup` — should create target + 6 executions + patch `ZITADEL_WEBHOOK_SECRET`
3. Verify via Zitadel UI (Actions > Targets, Actions > Executions) that all 6 events are configured
4. Register a test user in Zitadel UI → confirm webhook fires and user appears in Colophony DB
5. Run existing tests: `pnpm --filter @colophony/api test:webhooks`
