# Architecture Reference

Detailed architecture documentation for the Prospector submissions platform.
For day-to-day development guidance, see [CLAUDE.md](../CLAUDE.md).

---

## System Overview

Multi-tenant submissions management platform for creative arts magazines.

**Deployment model:**

- **Phase 1 (MVP)**: Self-hosted via Docker Compose (WordPress-like)
- **Phase 2 (SaaS)**: Unified platform with optional self-hosted instances

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
- **web** — Next.js 15 frontend (standalone output)
- **api** — NestJS API with tRPC, BullMQ background jobs
- **tusd** — Resumable file upload server (tus protocol)
- **postgres** — PostgreSQL 16 with Row-Level Security
- **redis** — Sessions, cache, BullMQ job queue
- **minio** — S3-compatible file storage
- **clamav** — Virus scanning (optional, `--profile full`)
- **migrate** — One-shot: runs Prisma migrations + RLS policies

For deployment details, see [docs/deployment.md](./deployment.md).

---

## Technology Stack

### Frontend

| Library        | Version        | Purpose                 |
| -------------- | -------------- | ----------------------- |
| Next.js        | 15             | App Router, SSR         |
| TypeScript     | strict mode    | Type safety             |
| Tailwind CSS   | 3.4            | Utility-first CSS       |
| shadcn/ui      | New York style | Component library       |
| tRPC client    | 10.45          | End-to-end type safety  |
| TanStack Query | 4.36           | Server state management |
| tus-js-client  | 4.3.1          | Resumable file uploads  |
| date-fns       | —              | Date formatting         |

### Backend

| Library           | Version | Purpose               |
| ----------------- | ------- | --------------------- |
| NestJS            | 10.4    | Application framework |
| tRPC server       | 10.45   | API layer (NOT REST)  |
| Prisma            | 5.22    | ORM + migrations      |
| BullMQ            | 5       | Background job queue  |
| Passport.js + JWT | —       | Authentication        |
| Stripe            | 20.3    | Payment processing    |
| nodemailer        | —       | Email sending         |

### Data & Infrastructure

| Technology     | Version | Purpose                                 |
| -------------- | ------- | --------------------------------------- |
| PostgreSQL     | 16+     | Primary database with RLS               |
| Redis          | 7+      | Sessions, jobs, cache                   |
| MinIO          | —       | S3-compatible storage (dev/self-hosted) |
| Docker Compose | v2      | Container orchestration                 |

---

## Project Structure

**Package naming convention:** `@prospector/*` (e.g., `@prospector/db`, `@prospector/api`)

```
prospector/
├── CLAUDE.md                        # AI assistant context (concise)
├── package.json                     # Root pnpm workspace (husky + lint-staged)
├── pnpm-workspace.yaml
├── turbo.json                       # Turborepo config
├── docker-compose.yml               # Dev stack
├── docker-compose.prod.yml          # Production stack
├── .env.example                     # Dev env template
├── .env.prod.example                # Production env template
├── .dockerignore
├── .gitignore
├── .husky/
│   └── pre-commit                   # Secret scanning + lint-staged
├── .github/
│   ├── workflows/
│   │   └── ci.yml                   # CI: lint, type-check, tests, build
│   └── pull_request_template.md
│
├── apps/
│   ├── web/                         # Next.js + tRPC client
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                    # Landing page
│   │   │   │   ├── (auth)/                     # Auth pages (no sidebar)
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   ├── register/page.tsx
│   │   │   │   │   └── verify-email/page.tsx
│   │   │   │   └── (dashboard)/                # Protected pages (with sidebar)
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── page.tsx                # Dashboard home
│   │   │   │       ├── submissions/page.tsx
│   │   │   │       ├── submissions/new/page.tsx
│   │   │   │       ├── submissions/[id]/page.tsx
│   │   │   │       ├── submissions/[id]/edit/page.tsx
│   │   │   │       ├── editor/page.tsx
│   │   │   │       ├── editor/[id]/page.tsx
│   │   │   │       ├── settings/page.tsx       # Account + GDPR controls
│   │   │   │       ├── payment/success/page.tsx
│   │   │   │       └── payment/cancel/page.tsx
│   │   │   ├── components/
│   │   │   │   ├── providers.tsx               # tRPC + QueryClient providers
│   │   │   │   ├── ui/                         # 21 shadcn/ui components
│   │   │   │   ├── auth/                       # login-form, register-form, verify-email-form, protected-route
│   │   │   │   ├── submissions/                # list, card, form, detail, file-upload, status-badge
│   │   │   │   ├── editor/                     # dashboard, status-transition, submission-review
│   │   │   │   └── layout/                     # header, sidebar, org-switcher, user-menu
│   │   │   ├── hooks/
│   │   │   │   ├── use-auth.ts                 # Auth state, login/logout/register
│   │   │   │   ├── use-organization.ts         # Org context, role checks
│   │   │   │   └── use-file-upload.ts          # tus-js-client wrapper
│   │   │   └── lib/
│   │   │       ├── trpc.ts                     # tRPC client with org header
│   │   │       ├── auth.ts                     # Token storage utilities
│   │   │       └── utils.ts                    # shadcn cn() utility
│   │   ├── e2e/                                # Playwright browser E2E tests
│   │   │   ├── auth.spec.ts                    # 7 tests
│   │   │   ├── submissions.spec.ts             # 7 tests
│   │   │   ├── editor.spec.ts                  # 5 tests
│   │   │   └── helpers/
│   │   │       ├── auth.ts                     # setupTestUser, loginAsBrowser, loginViaForm
│   │   │       ├── api-client.ts               # Direct tRPC fetch with 429 retry
│   │   │       └── db.ts                       # PrismaClient for test data (superuser)
│   │   ├── playwright.config.ts
│   │   └── package.json
│   │
│   └── api/                         # NestJS + tRPC server + Workers
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   ├── trpc/
│       │   │   ├── trpc.service.ts
│       │   │   ├── trpc.module.ts
│       │   │   ├── trpc.controller.ts          # HTTP handler (strips /trpc prefix)
│       │   │   ├── trpc.context.ts             # Auth + org context creation
│       │   │   ├── trpc.registry.ts            # Procedure registry
│       │   │   ├── trpc.router.ts              # Root router (combines all)
│       │   │   └── routers/
│       │   │       ├── auth.router.ts           # login, register, refresh, logout, me
│       │   │       ├── submissions.router.ts    # CRUD + workflow transitions
│       │   │       ├── files.router.ts          # Upload initiation, signing
│       │   │       ├── payments.router.ts       # Stripe checkout sessions
│       │   │       ├── gdpr.router.ts           # DSAR, export, erasure
│       │   │       ├── consent.router.ts        # Grant/revoke consent
│       │   │       ├── audit.router.ts          # Audit event queries (admin)
│       │   │       └── retention.router.ts      # Retention policy CRUD (admin)
│       │   └── modules/
│       │       ├── auth/                        # AuthService (JWT + refresh tokens)
│       │       ├── email/                       # EmailService + EmailTemplateService
│       │       ├── storage/                     # StorageService + TusdWebhookController
│       │       ├── payments/                    # PaymentsService + StripeService + webhook
│       │       ├── gdpr/                        # GdprService (export, erasure, DSAR)
│       │       ├── audit/                       # AuditService (15+ action types, CSV)
│       │       ├── redis/                       # RedisService
│       │       ├── security/                    # RateLimitService + RateLimitGuard
│       │       └── jobs/                        # BullMQ processors + services
│       │           ├── constants.ts             # Queue names
│       │           ├── jobs.module.ts
│       │           ├── processors/
│       │           │   ├── virus-scan.processor.ts
│       │           │   ├── email.processor.ts
│       │           │   └── retention.processor.ts
│       │           └── services/
│       │               ├── virus-scan.service.ts
│       │               ├── retention.service.ts
│       │               └── outbox.service.ts
│       ├── test/                                # API test suite
│       │   ├── unit/                            # 10 unit test files (191 tests)
│       │   ├── integration/
│       │   │   └── rls.spec.ts                  # RLS isolation tests
│       │   ├── e2e/                             # 4 E2E test files (65 tests)
│       │   │   ├── auth.e2e-spec.ts
│       │   │   ├── submissions.e2e-spec.ts
│       │   │   ├── gdpr.e2e-spec.ts
│       │   │   └── payments.e2e-spec.ts
│       │   ├── app.e2e-spec.ts                  # Health check test
│       │   ├── e2e-app.module.ts                # Test AppModule (no BullMQ)
│       │   ├── e2e-helpers.ts                   # createTestApp, registerUser, etc.
│       │   ├── e2e-setup.ts                     # Env config (test DB, Redis, rate limits)
│       │   ├── jest-e2e.json
│       │   └── utils/
│       │       ├── test-context.ts              # cleanDatabase (DB + Redis flush)
│       │       ├── mock-redis.ts
│       │       └── factories/                   # createOrg, createUser, createSubmission
│       └── package.json
│
├── packages/
│   ├── db/                          # Prisma + RLS context helpers
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Complete schema (17+ tables)
│   │   │   ├── rls-policies.sql     # RLS policies SQL
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts            # Prisma singleton
│   │   │   └── context.ts           # withOrgContext, createContextHelpers
│   │   └── package.json
│   │
│   ├── types/                       # Shared Zod schemas (8 files)
│   │   ├── src/
│   │   │   ├── index.ts             # Re-exports
│   │   │   ├── auth.ts              # LoginInput, RegisterInput, etc.
│   │   │   ├── common.ts            # Pagination, responses
│   │   │   ├── submission.ts        # Submission schemas + status enums
│   │   │   ├── file.ts              # File upload schemas
│   │   │   ├── payment.ts           # Payment schemas
│   │   │   ├── organization.ts      # Organization schemas
│   │   │   └── user.ts              # User schemas
│   │   └── package.json
│   │
│   ├── typescript-config/           # Shared TS configs
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   ├── nestjs.json
│   │   └── library.json
│   │
│   └── eslint-config/              # Shared ESLint configs
│       ├── base.js
│       ├── nextjs.js
│       └── nestjs.js
│
├── .claude/
│   ├── hooks/
│   │   ├── hooks.json               # Hook configuration
│   │   ├── pre-edit-validate.js     # Blocks secrets, warns missing RLS
│   │   ├── pre-frontend-validate.js # Validates frontend patterns
│   │   ├── pre-payment-validate.js  # Warns missing idempotency
│   │   ├── pre-router-audit.js      # Warns missing audit logging in routers
│   │   ├── post-schema.js           # Auto-regenerates Prisma client
│   │   ├── post-email-template.js   # Reminds text version for emails
│   │   ├── post-migration-validate.js # Reminds RLS for new tables
│   │   └── post-commit-devlog.js    # Reminds to update DEVLOG.md
│   ├── skills/
│   │   ├── db-reset.md              # /db-reset
│   │   ├── new-router.md            # /new-router <name>
│   │   ├── new-module.md            # /new-module <name>
│   │   ├── new-processor.md         # /new-processor <name>
│   │   ├── new-migration.md         # /new-migration <name>
│   │   ├── new-page.md              # /new-page <name>
│   │   ├── new-component.md         # /new-component <name>
│   │   ├── new-hook.md              # /new-hook <name>
│   │   ├── new-e2e.md               # /new-e2e <feature>
│   │   ├── stripe-webhook.md        # /stripe-webhook <event>
│   │   └── test-rls.md              # /test-rls
│   └── mcp-servers.example.json     # MCP server config template
│
├── scripts/
│   ├── init-db.sh                   # Dev PostgreSQL init (creates app_user)
│   ├── install.sh                   # Production install script
│   ├── init-prod.sh                 # Production migration + RLS setup
│   └── check-secrets.sh             # Pre-commit secret scanner
│
├── nginx/
│   └── nginx.conf                   # Reverse proxy config
│
└── docs/
    ├── architecture.md              # This file
    ├── testing.md                   # Testing guide
    ├── deployment.md                # Deployment guide
    └── DEVLOG.md                    # Session log
```

---

## Database Schema

### Core Tables

| Table                     | Purpose                | Key Fields                                                                   |
| ------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| **organizations**         | Multi-tenant root      | `id`, `name`, `slug`, `settings` (JSONB)                                     |
| **users**                 | Global user pool       | `id`, `email`, `passwordHash`, `emailVerifiedAt`, `deletedAt` (soft delete)  |
| **user_identities**       | Federated identity     | `provider` (email/google/github), `providerUserId`, `userId`                 |
| **organization_members**  | M:N users ↔ orgs       | `userId`, `organizationId`, `role` (admin/editor/reader)                     |
| **submissions**           | RLS-enforced content   | `organizationId`, `submitterId`, `status`, `searchVector` (tsvector)         |
| **submission_files**      | Attached files         | `submissionId`, `storageKey`, `scanStatus` (pending/scanning/clean/infected) |
| **submission_history**    | Immutable status log   | `submissionId`, `fromStatus`, `toStatus`, `changedBy`, `comment`             |
| **payments**              | Idempotent tracking    | `submissionId`, `stripePaymentIntentId`, `status`, `amount`                  |
| **stripe_webhook_events** | Deduplication          | `eventId`, `eventType`, `processed` (boolean)                                |
| **audit_events**          | GDPR Article 30        | `actorId`, `action`, `resource`, `resourceId`, `ipAddress`, `userAgent`      |
| **dsar_requests**         | Data Subject Access    | `userId`, `type`, `status`, `dueAt` (30 days)                                |
| **retention_policies**    | Data lifecycle         | `resource`, `retentionDays`, `active`                                        |
| **user_consents**         | GDPR consent           | `userId`, `organizationId`, `consentType`, `grantedAt`, `revokedAt`          |
| **outbox_events**         | Reliable notifications | `eventType`, `recipientEmail`, `templateName`, `processedAt`, `retryCount`   |

### Indexes

```sql
-- Hot query paths
CREATE INDEX idx_submissions_org_status_date
  ON submissions(organization_id, status, submitted_at DESC);

CREATE INDEX idx_submissions_submitter_date
  ON submissions(submitter_id, submitted_at DESC);

CREATE INDEX idx_files_submission
  ON submission_files(submission_id);

CREATE INDEX idx_files_scan_pending
  ON submission_files(scan_status, uploaded_at)
  WHERE scan_status = 'pending';

CREATE INDEX idx_members_user_org
  ON organization_members(user_id, organization_id);

CREATE INDEX idx_history_submission_date
  ON submission_history(submission_id, changed_at DESC);

CREATE INDEX idx_audit_actor
  ON audit_events(actor_id, created_at DESC);

CREATE INDEX idx_webhook_unprocessed
  ON stripe_webhook_events(processed, received_at)
  WHERE processed = false;

-- Full-text search
CREATE INDEX idx_submissions_search
  ON submissions USING GIN(search_vector);
```

### RLS Policies

**MUST BE APPLIED** to prevent cross-tenant data leakage.

```sql
-- Helper functions
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- CRITICAL: Use FORCE to apply RLS even for table owners/superusers
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions FORCE ROW LEVEL SECURITY;

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files FORCE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

-- Policy example
CREATE POLICY org_isolation ON submissions
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- Repeat for other tenant tables
```

**Non-superuser role (required — superusers bypass RLS):**

```sql
CREATE ROLE app_user WITH LOGIN PASSWORD 'password' NOSUPERUSER NOBYPASSRLS;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT EXECUTE ON FUNCTION current_org_id() TO app_user;
GRANT EXECUTE ON FUNCTION current_user_id() TO app_user;
```

---

## Multi-Tenancy with RLS

**All organization-scoped queries MUST use the `withOrgContext` pattern:**

```typescript
// packages/db/src/context.ts
async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<T> {
  // Validate UUIDs to prevent SQL injection
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId) || !uuidRegex.test(userId)) {
    throw new Error("Invalid UUID format");
  }

  return prismaClient.$transaction(async (tx) => {
    // CRITICAL: Use SET LOCAL (not SET) - transaction-scoped
    // Note: app.user_id not app.current_user (reserved keyword)
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org = '${orgId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${userId}'`);
    return fn(tx);
  });
}

// Usage in tRPC routers — ctx.prisma is already wrapped
export const submissionsRouter = router({
  list: orgProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(({ ctx, input }) => {
      return ctx.prisma.submission.findMany({
        where: { status: input.status },
      });
    }),
});
```

**NEVER:**

- Query without org context
- Use session-level `SET` (always `SET LOCAL`)
- Manually filter by `organizationId` (RLS does this)
- Use `app.current_user` (reserved keyword — use `app.user_id`)
- Use `$executeRaw` template literals for SET LOCAL (doesn't work with Prisma)

---

## Authentication Flow

**Hybrid JWT + Refresh Token:**

| Token   | TTL    | Storage                    | Rotation                       |
| ------- | ------ | -------------------------- | ------------------------------ |
| Access  | 15 min | Client memory/localStorage | Stateless (JWT)                |
| Refresh | 7 days | Redis                      | Single-use, rotated on refresh |

```typescript
// Login returns both tokens
{ accessToken: string, refreshToken: string }

// Refresh endpoint revokes old token, issues new pair
POST /auth/refresh { refreshToken } → new { accessToken, refreshToken }

// Logout deletes all user's refresh tokens
DELETE /auth/logout → redis.del(`refresh:${userId}:*`)
```

**Implementation:** `apps/api/src/modules/auth/auth.service.ts`

---

## File Upload Flow

```
1. Client → tusd sidecar (chunked, resumable via tus protocol)
2. tusd pre-create hook → API validates (auth, quota, file type)
3. tusd post-finish hook → API creates SubmissionFile record (quarantine)
4. BullMQ job → ClamAV virus scan
5. If clean → update scanStatus, move to production bucket
6. If infected → quarantine, notify user
```

**Key files:**

- `apps/api/src/modules/storage/tusd-webhook.controller.ts` — tusd hooks
- `apps/api/src/modules/jobs/processors/virus-scan.processor.ts` — scan job
- `apps/web/src/hooks/use-file-upload.ts` — tus-js-client wrapper

---

## Payment Flow (Stripe)

```
1. User clicks "Submit & Pay"
2. Backend creates Stripe Checkout session
3. User redirected to Stripe (card data never touches our servers)
4. Stripe webhook → checkout.session.completed
5. Webhook handler (idempotent):
   a. Check StripeWebhookEvent.processed
   b. Create Payment record
   c. Update Submission.status → 'submitted'
   d. Send confirmation email
```

**Key files:**

- `apps/api/src/modules/payments/stripe-webhook.controller.ts` — webhook handler
- `apps/api/src/modules/payments/payments.service.ts` — checkout session creation
- `apps/api/src/trpc/routers/payments.router.ts` — tRPC endpoints

---

## GDPR Compliance

### Right to Access (Article 15)

```typescript
// Export user data as structured JSON
const data = await gdprService.exportUserData(userId);
// Returns: { profile, submissions, payments, consents, auditLog, organizations }

// Export as ZIP file for download
const zipBuffer = await gdprService.exportUserDataAsZip(userId);
// ZIP contains: profile.json, submissions.json, payments.json,
//               audit-log.json, consents.json, organizations.json, metadata.json
```

### Right to Erasure (Article 17)

```typescript
await gdprService.deleteUserData(userId);
// 1. Delete files from storage
// 2. Anonymize submission content
// 3. Delete organization memberships
// 4. Delete user identities (OAuth)
// 5. Delete user consents
// 6. Soft-delete user with anonymized email
// 7. Anonymize audit events (remove actor association)
// 8. Create audit log of the erasure
```

### Data Subject Access Requests (DSAR)

```typescript
// Create a DSAR request (30-day deadline per GDPR)
const { id, dueAt } = await gdprService.createDsarRequest({
  userId: "user-123",
  type: "ACCESS" | "ERASURE" | "RECTIFICATION" | "PORTABILITY",
  notes: "Optional notes",
});

// Admin can monitor approaching deadlines
const pending = await gdprService.getPendingDsarRequests(7); // Due within 7 days
```

### Consent Management (Article 7)

```typescript
// tRPC endpoints for user consent
await trpc.consent.grant({ consentType: "marketing_emails", organizationId });
await trpc.consent.revoke({ consentType: "analytics" });
const hasConsent = await trpc.consent.check({
  consentType: "terms_of_service",
});
```

### Retention Policies (Article 5(1)(e))

- Daily BullMQ job runs at 3 AM UTC
- Configurable per-resource retention periods
- Default policies:
  - Rejected submissions: 12 months
  - Withdrawn submissions: 24 months
  - Audit events: 24 months (GDPR Article 30 minimum)
  - Processed outbox events: 30 days
  - Stripe webhook events: 90 days
  - Completed DSAR requests: 12 months
- Payments are NOT auto-deleted (legal/accounting requirements)

### Audit Logging (Article 30)

```typescript
await auditService.log({
  organizationId: "org-123",
  actorId: "user-456",
  action: AuditActions.SUBMISSION_CREATED, // 15+ predefined actions
  resource: AuditResources.SUBMISSION,
  resourceId: "sub-789",
  oldValue: { status: "DRAFT" },
  newValue: { status: "SUBMITTED" },
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
});

// Export audit logs as CSV
const csv = await auditService.exportAsCsv({
  organizationId,
  dateFrom,
  dateTo,
});
```

### Transactional Outbox Pattern

```typescript
// Ensures notifications are sent even if system crashes
await outboxService.createEvent({
  eventType: 'submission.accepted',
  recipientEmail: 'user@example.com',
  templateName: 'submissionStatusChange',
  templateData: { userName: 'John', submissionTitle: 'My Story', ... }
}, tx); // Created in same transaction as main action

// Background processor polls every 30 seconds
// Exponential backoff: 10s, 30s, 90s, 270s, 810s (max 5 retries)
```

---

## Frontend Architecture

### tRPC Client Configuration

```typescript
// apps/web/src/lib/trpc.ts
// Sends Authorization header + x-organization-id header
export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        headers() {
          const token = getAccessToken();
          const orgId = getCurrentOrgId();
          return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(orgId ? { "x-organization-id": orgId } : {}),
          };
        },
      }),
    ],
  });
}
```

### Auth Token Management

```typescript
// Store tokens on login
setAuthTokens(accessToken, refreshToken, expiresIn);

// Auto-refresh before expiry (scheduled 1 min before)
if (isTokenExpiringSoon()) {
  await refreshMutation.mutateAsync({ refreshToken });
}

// Clear on logout
clearAuthData();
```

### Protected Route Pattern

```typescript
<ProtectedRoute requireEmailVerified requireEditor>
  <EditorDashboard />
</ProtectedRoute>
```

### Organization Context

```typescript
// useOrganization hook provides role-based access
const { currentOrg, isEditor, isAdmin, switchOrganization } = useOrganization();
```

### File Upload with tus-js-client

```typescript
// 1. Initiate upload to get URL
const { fileId, uploadUrl } = await trpc.files.initiateUpload.mutateAsync({...});

// 2. Upload via tus
const upload = new tus.Upload(file, {
  endpoint: uploadUrl,
  chunkSize: 5 * 1024 * 1024,
  onProgress: (bytesUploaded, bytesTotal) => {...},
  onSuccess: () => {...},
});
upload.start();
```

### API Response Patterns

- Paginated lists return `{ items, total, page, limit, totalPages }`
- Update mutations expect `{ id, data: {...} }` format
- Status transitions use `EDITOR_ALLOWED_TRANSITIONS` from `@prospector/types`

### Available tRPC Routers

```typescript
// apps/api/src/trpc/trpc.router.ts
export const appRouter = router({
  auth: authRouter, // login, register, refresh, verify, logout, resetPassword, me
  submissions: submissionsRouter, // list, getById, create, update, submit, withdraw
  files: filesRouter, // getUploadUrl, confirmUpload, delete
  payments: paymentsRouter, // createCheckoutSession, getForSubmission
  gdpr: gdprRouter, // createDsarRequest, exportData, downloadExport, requestDeletion
  consent: consentRouter, // list, grant, revoke, check, bulkGrant
  audit: auditRouter, // list, getById, getResourceHistory, exportCsv, getStats
  retention: retentionRouter, // list, create, update, delete, toggleActive, getDefaults
});
```
