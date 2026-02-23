# Track 4: Slate — Publication Pipeline Design

## Context

Tracks 1-3 are complete. Track 4 (Slate) covers the post-acceptance publication pipeline: copyedit, proofread, contracts, issue assembly, and CMS publishing. This design defines the full schema, services, workflows, adapter interfaces, and implementation order for all 6 Track 4 backlog items.

**Decisions confirmed:**

- Workflow orchestration: **Inngest** (1 Docker container, step functions, `waitForEvent`)
- Publication hierarchy: **Add Publication entity** (Org → Publications → Periods/Issues)
- CMS scope: **Integration-only for v2.0** (WordPress/Ghost adapters, defer built-in pages)
- Contracts: **Org-managed templates** with merge fields, Documenso as signing mechanism

---

## 1. New Enums

**File:** `packages/db/src/schema/enums.ts`

- `publicationStatusEnum`: ACTIVE, ARCHIVED
- `pipelineStageEnum`: COPYEDIT_PENDING, COPYEDIT_IN_PROGRESS, AUTHOR_REVIEW, PROOFREAD, READY_TO_PUBLISH, PUBLISHED, WITHDRAWN
- `contractStatusEnum`: DRAFT, SENT, VIEWED, SIGNED, COUNTERSIGNED, COMPLETED, VOIDED
- `issueStatusEnum`: PLANNING, ASSEMBLING, READY, PUBLISHED, ARCHIVED
- `cmsAdapterTypeEnum`: WORDPRESS, GHOST

## 2. New Tables

### `publications` (packages/db/src/schema/publications.ts)

- id, organization_id, name, slug, description, settings (jsonb), status, created_at, updated_at
- RLS: org isolation policy, unique (organization_id, lower(slug))

### `pipeline_items` (packages/db/src/schema/pipeline.ts)

- id, organization_id, submission_id (unique 1:1), publication_id, stage, assigned_copyeditor_id, assigned_proofreader_id, due dates, inngest_run_id, timestamps

### `pipeline_history`

- id, pipeline_item_id, from_stage, to_stage, changed_by, comment, changed_at
- RLS: nested SELECT on parent org

### `pipeline_comments`

- id, pipeline_item_id, author_id, content, stage, created_at
- RLS: nested SELECT on parent org

### `contract_templates`

- id, organization_id, name, description, body, merge_fields (jsonb), is_default, timestamps
- RLS: org isolation

### `contracts`

- id, organization_id, pipeline_item_id, contract_template_id, status, rendered_body, merge_data, documenso_document_id, sign dates, timestamps
- RLS: org isolation

### `issues`

- id, organization_id, publication_id, title, volume, issue_number, description, cover_image_url, status, publication_date, published_at, metadata, timestamps
- RLS: org isolation

### `issue_sections`

- id, issue_id, title, sort_order, created_at
- RLS: nested SELECT on issues.organization_id

### `issue_items`

- id, issue_id, pipeline_item_id, issue_section_id, sort_order, created_at
- RLS: nested SELECT on issues.organization_id

### `cms_connections`

- id, organization_id, publication_id, adapter_type, name, config, is_active, last_sync_at, timestamps
- RLS: org isolation

### `documenso_webhook_events`

- id, documenso_id (unique), type, payload, processed, processed_at, error, received_at
- No RLS (system table)

## 3. Schema Modifications

- `submission_periods`: add nullable `publication_id` FK to `publications`

## 4. Pipeline Transition Logic

Valid transitions defined in `packages/types/src/pipeline.ts`

## 5. Inngest Integration

Docker Compose service, env vars, client, events, serve endpoint, workflow functions

## 6. Services

publicationService, pipelineService, contractTemplateService, contractService, issueService, cmsConnectionService

## 7. Types

publication.ts, pipeline.ts, contract.ts, issue.ts — all with Zod schemas

## 8. API Surface

tRPC, REST, GraphQL for all entities. New API key scopes.

## 9. Adapter Interfaces

Documenso adapter, CMS adapter interface (WordPress, Ghost implementations)

## 10. Implementation Order (9 PRs)

| PR  | Scope                                                               | Depends On |
| --- | ------------------------------------------------------------------- | ---------- |
| 1   | Publications — schema, types, service, tRPC/REST/GraphQL            | —          |
| 2   | Pipeline Core — pipeline_items, history, comments, transition logic | PR 1       |
| 3   | Inngest Integration — Docker, env, client, serve, pipeline-workflow | PR 2       |
| 4   | Contract Templates + Contracts — schema, types, services            | PR 2       |
| 5   | Documenso Adapter + Webhook — adapter, handler, contract-workflow   | PR 3 + 4   |
| 6   | Issue Assembly — issues, sections, items, TOC generation            | PR 2       |
| 7   | CMS Adapters — connections, WordPress/Ghost, cms-publish            | PR 3 + 6   |
| 8   | Frontend — pipeline dashboard, issue assembly UI, calendar          | PR 1-7     |
| 9   | E2E Tests — Playwright tests for Slate pipeline flows               | PR 8       |
