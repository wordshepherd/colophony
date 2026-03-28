# Content Extraction Pipeline

## Context

The ManuscriptRenderer (frontend) already renders ProseMirror JSON with genre-aware typography. Currently it only works with the client-side `textToProseMirrorDoc` fallback. This plan adds the **backend pipeline** that converts uploaded files to ProseMirror JSON after virus scanning, enabling real content display in the editorial split pane.

Pipeline: file upload → tusd → ClamAV scan → CLEAN → **content-extract BullMQ job** → ProseMirror JSON → store in DB.

---

## Step 1: Shared ProseMirror Types

Move ProseMirror type definitions from the frontend to the shared types package so both backend converters and frontend renderer use the same types.

**Create** `packages/types/src/prosemirror.ts`:

- Export: `GenreHint`, `ProseMirrorMark`, `ProseMirrorNodeType`, `ProseMirrorNode`, `SubmissionMetadata`, `ProseMirrorDoc`, `ReadingAnchor`
- Identical to current definitions in `apps/web/src/lib/manuscript.ts` lines 7-52

**Modify** `packages/types/src/index.ts`:

- Add `export * from "./prosemirror.js";`

**Modify** `apps/web/src/lib/manuscript.ts`:

- Replace inline type definitions with re-exports from `@colophony/types`
- Keep `textToProseMirrorDoc` and its helpers (frontend-only runtime code)

---

## Step 2: Schema Migration

**Modify** `packages/db/src/schema/enums.ts`:

- Add after `scanStatusEnum` (line 22):

```typescript
export const contentExtractionStatusEnum = pgEnum("ContentExtractionStatus", [
  "PENDING",
  "EXTRACTING",
  "COMPLETE",
  "FAILED",
  "UNSUPPORTED",
]);
```

**Modify** `packages/db/src/schema/manuscripts.ts`:

- Import `contentExtractionStatusEnum`
- Add 3 columns to `manuscriptVersions`:
  - `content: jsonb("content")` — nullable, ProseMirror JSON
  - `contentFormat: varchar("content_format", { length: 50 })` — nullable, initially `'prosemirror_v1'`
  - `contentExtractionStatus: contentExtractionStatusEnum("content_extraction_status").notNull().default("PENDING")`

**Generate migration** via `pnpm db:generate` (or write manually if TUI blocks):

```sql
CREATE TYPE "ContentExtractionStatus" AS ENUM ('PENDING', 'EXTRACTING', 'COMPLETE', 'FAILED', 'UNSUPPORTED');
--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD COLUMN "content" jsonb;
--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD COLUMN "content_format" varchar(50);
--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD COLUMN "content_extraction_status" "ContentExtractionStatus" DEFAULT 'PENDING' NOT NULL;
```

No RLS changes — new columns inherit existing row-level policies.

---

## Step 3: Audit Constants

**Modify** `packages/types/src/audit.ts`:

- Add actions after `MANUSCRIPT_VERSION_CREATED` (line 84):

```typescript
CONTENT_EXTRACT_COMPLETE: "CONTENT_EXTRACT_COMPLETE",
CONTENT_EXTRACT_FAILED: "CONTENT_EXTRACT_FAILED",
CONTENT_EXTRACT_UNSUPPORTED: "CONTENT_EXTRACT_UNSUPPORTED",
```

- Add to `ManuscriptAuditParams` union (line 374, uses existing `MANUSCRIPT` resource):

```typescript
| typeof AuditActions.CONTENT_EXTRACT_COMPLETE
| typeof AuditActions.CONTENT_EXTRACT_FAILED
| typeof AuditActions.CONTENT_EXTRACT_UNSUPPORTED;
```

---

## Step 4: Converters

### `apps/api/src/converters/text-converter.ts` (NEW)

Server-side port of frontend `textToProseMirrorDoc`. Identical logic to `apps/web/src/lib/manuscript.ts:68-152` but imports types from `@colophony/types`.

```typescript
export function convertTextToProseMirror(
  text: string,
  genreHint?: GenreHint,
): ProseMirrorDoc;
```

- Internal: `convertProse(text)`, `convertPoetry(text)` — same algorithms as frontend

### `apps/api/src/converters/docx-converter.ts` (NEW)

Uses mammoth.js → HTML, then maps HTML to ProseMirror nodes via htmlparser2.

```typescript
export async function convertDocxToProseMirror(
  buffer: Buffer,
  genreHint?: GenreHint,
): Promise<ProseMirrorDoc>;
```

- mammoth style map: `<w:smallCaps/>` → `small_caps` mark
- HTML→ProseMirror mapping:
  - `<p>` → `paragraph` (prose) or `poem_line` (poetry)
  - `<em>`/`<i>` → `emphasis` mark
  - `<strong>`/`<b>` → `strong` mark
  - `<blockquote>` → `block_quote`
  - Empty `<p>` → `section_break` (prose) or `stanza_break` (poetry)
- Poetry mode: detect leading whitespace → `preserved_indent` with `depth`

### `apps/api/src/converters/smart-typography.ts` (NEW)

```typescript
export function applySmartTypography(doc: ProseMirrorDoc): ProseMirrorDoc;
export function smartifyText(text: string): { text: string; changed: boolean };
```

- Rules: `"` → `""`/`""`, `'` → `''`/`''` (context-sensitive), `--`/`---` → `—`, `...` → `…` (excluding `Mr.`, `Mrs.`, `Dr.`, `vs.`, `etc.`, `i.e.`, `e.g.`)
- Walks all nodes. For each text node where `smartifyText` returns `changed: true`: set `smart_text` mark with `attrs.original` = original text
- Sets `doc.attrs.smart_typography_applied = true`

### `apps/api/src/converters/index.ts` (NEW)

Format router + barrel:

```typescript
export type ConversionResult =
  | { status: "success"; doc: ProseMirrorDoc }
  | { status: "unsupported"; mimeType: string };

export async function convertFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  genreHint?: GenreHint,
): Promise<ConversionResult>;
```

- `text/plain` → text converter
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → docx converter
- Anything else → `{ status: 'unsupported' }`
- After format conversion: apply `applySmartTypography`, set `submission_metadata` attrs

### Dependencies

**Modify** `apps/api/package.json` — add:

- `mammoth: ^1.8.0` (.docx conversion)
- `htmlparser2: ^9.1.0` (server-side HTML parsing)

---

## Step 5: Content Extraction Service

**Create** `apps/api/src/services/content-extraction.service.ts`

```typescript
export const contentExtractionService = {
  async getStatus(tx: DrizzleDb, manuscriptVersionId: string): Promise<string | null>;
  async updateStatus(tx: DrizzleDb, manuscriptVersionId: string, status: string): Promise<void>;
  async storeContent(tx: DrizzleDb, manuscriptVersionId: string, content: ProseMirrorDoc, contentFormat?: string): Promise<void>;
  async getGenreHintForVersion(tx: DrizzleDb, manuscriptVersionId: string): Promise<GenreHint | null>;
};
```

- `getStatus`: SELECT `content_extraction_status` WHERE id = versionId
- `updateStatus`: UPDATE `content_extraction_status` WHERE id = versionId
- `storeContent`: UPDATE `content`, `content_format` (default `'prosemirror_v1'`), `content_extraction_status` = `'COMPLETE'`
- `getGenreHintForVersion`: JOIN `manuscript_versions` → `manuscripts` to get `genre.primary`, map to `GenreHint`

---

## Step 6: Queue Definition

**Create** `apps/api/src/queues/content-extract.queue.ts`

```typescript
export interface ContentExtractJobData {
  fileId: string;
  storageKey: string;
  manuscriptVersionId: string;
  userId: string;
  organizationId?: string;
  mimeType: string;
  filename: string;
}
```

- Queue name: `content-extract`
- Job options: `attempts: 3`, exponential backoff 30s, removeOnComplete 24h, removeOnFail 7d
- Idempotency: `jobId: data.fileId`
- Exports: `enqueueContentExtract()`, `getContentExtractQueueInstance()`, `closeContentExtractQueue()`

**Modify** `apps/api/src/queues/index.ts` — add barrel exports

---

## Step 7: Worker

**Create** `apps/api/src/workers/content-extract.worker.ts`

```typescript
export function startContentExtractWorker(
  env: Env,
  registry: AdapterRegistry,
): Worker<ContentExtractJobData>;
export async function stopContentExtractWorker(): Promise<void>;
```

Processor phases:

1. **Idempotency + EXTRACTING**: `withRls({ userId })` → check status, skip if COMPLETE, set EXTRACTING
2. **Download**: `storage.downloadFromBucket(defaultBucket, storageKey)` → collect to Buffer (outside withRls). Size guard: skip files > 50MB → UNSUPPORTED.
3. **Convert**: `convertFile(buffer, mimeType, filename, genreHint)` — genreHint fetched from DB in phase 1
4. **Store/Audit**: `withRls({ userId })` →
   - If `success`: `storeContent()` + audit `CONTENT_EXTRACT_COMPLETE` (with `{ filename, mimeType, contentFormat, nodeCount }`)
   - If `unsupported`: `updateStatus('UNSUPPORTED')` + audit `CONTENT_EXTRACT_UNSUPPORTED`
5. **Error catch**: `updateStatus('FAILED')` + audit `CONTENT_EXTRACT_FAILED` + re-throw for retry

Concurrency: 3. RLS context: `{ userId }` (user-scoped, no orgId in audit — same pattern as file-scan worker).

**Modify** `apps/api/src/workers/index.ts` — add barrel exports

---

## Step 8: Chaining — File-Scan Worker

**Modify** `apps/api/src/workers/file-scan.worker.ts`:

Add import: `import { enqueueContentExtract } from '../queues/content-extract.queue.js';`

After the CLEAN `withRls` block (after line 133, inside `if (!isInfected)` branch):

```typescript
// Chain: enqueue content extraction for the clean file
const file = await withRls(rlsCtx, async (tx) =>
  fileService.getById(tx, fileId),
);
if (file) {
  await enqueueContentExtract(env, {
    fileId: file.id,
    storageKey,
    manuscriptVersionId: file.manuscriptVersionId,
    userId: job.data.userId,
    organizationId: job.data.organizationId,
    mimeType: file.mimeType,
    filename: file.filename,
  });
}
```

---

## Step 9: Chaining — tusd Webhook (scan disabled)

**Modify** `apps/api/src/webhooks/tusd.webhook.ts`:

Add import: `import { enqueueContentExtract } from '../queues/content-extract.queue.js';`

After the S3 bucket move (line 643, inside the `!VIRUS_SCAN_ENABLED` block), enqueue content-extract:

```typescript
// Chain: enqueue content extraction when scan is skipped
await enqueueContentExtract(env, {
  fileId: fileIdToScan,
  storageKey,
  manuscriptVersionId,
  userId,
  ...(orgId ? { organizationId: orgId } : {}),
  mimeType,
  filename,
});
```

`manuscriptVersionId`, `mimeType`, and `filename` are already in scope from the webhook handler.

---

## Step 10: Worker Registration

**Modify** `apps/api/src/main.ts`:

- **Imports**: Add `startContentExtractWorker`, `stopContentExtractWorker`, `closeContentExtractQueue`, `getContentExtractQueueInstance`
- **Worker start** (after file-scan, ~line 380): `startContentExtractWorker(env, registry);` — always active (not feature-gated)
- **Queue depth polling** (~line 407): Add `{ name: 'content-extract', queue: getContentExtractQueueInstance() }`
- **Shutdown**: Add `await stopContentExtractWorker();` and `await closeContentExtractQueue();` in proper order (workers before queues)

---

## Step 11: Tests

### Unit: Text Converter

**`apps/api/src/__tests__/converters/text-converter.test.ts`** (NEW)

| Test              | Input                          | Assert                              |
| ----------------- | ------------------------------ | ----------------------------------- |
| prose paragraphs  | `"First\n\nSecond"`, prose     | 2 paragraphs, indent false/true     |
| section breaks    | `"Para\n\n\nPara"`, prose      | paragraph, section_break, paragraph |
| poetry lines      | `"Line one\nLine two"`, poetry | 2 poem_line nodes                   |
| stanza breaks     | `"L1\n\nL2"`, poetry           | poem_line, stanza_break, poem_line  |
| preserved indent  | `"    Indented"`, poetry       | preserved_indent with depth=2       |
| empty text        | `""`                           | empty content array                 |
| defaults to prose | no hint                        | paragraph nodes                     |

### Unit: Smart Typography

**`apps/api/src/__tests__/converters/smart-typography.test.ts`** (NEW)

| Test                         | Input                         | Assert                              |
| ---------------------------- | ----------------------------- | ----------------------------------- |
| double quotes                | `'She said "hello"'`          | curly doubles                       |
| single quotes / contractions | `"it's fine"`                 | curly apostrophe                    |
| double hyphen → em dash      | `"word -- word"`              | `\u2014`                            |
| triple hyphen → em dash      | `"word --- word"`             | `\u2014`                            |
| three dots → ellipsis        | `"wait..."`                   | `\u2026`                            |
| preserves Mr.                | `"Mr. Smith"`                 | unchanged                           |
| preserves etc.               | `"etc."`                      | unchanged                           |
| smart_text mark added        | doc with straight quotes      | mark with original attr             |
| unchanged nodes skipped      | doc with no convertible chars | no marks                            |
| doc flag set                 | any doc                       | `smart_typography_applied === true` |
| nested quotes                | `"She said 'hello'"`          | correct curling                     |

### Unit: Docx Converter

**`apps/api/src/__tests__/converters/docx-converter.test.ts`** (NEW)

| Test               | Input                     | Assert            |
| ------------------ | ------------------------- | ----------------- |
| basic paragraphs   | 2-paragraph .docx fixture | 2 paragraph nodes |
| emphasis preserved | .docx with italic         | emphasis mark     |
| strong preserved   | .docx with bold           | strong mark       |
| empty docx         | empty .docx               | empty content     |

Fixtures: `apps/api/src/__tests__/converters/fixtures/` — small .docx files (can be generated programmatically in test setup using mammoth's own test utilities or committed as binary).

### Integration: Content Extract Queue

**`apps/api/src/__tests__/queues/content-extract.queue.test.ts`** (NEW)

Follow pattern of existing queue tests (`email.queue.test.ts`). Uses `globalSetup`, `truncateAllTables`, Redis db 1, mock S3 adapter.

| Test                            | Setup                                    | Assert                                                                       |
| ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| PENDING → EXTRACTING → COMPLETE | .txt file (CLEAN), mock S3 returns text  | status COMPLETE, content is ProseMirrorDoc, contentFormat = 'prosemirror_v1' |
| UNSUPPORTED for unknown mime    | image/png file, mock S3 returns buffer   | status UNSUPPORTED, content null                                             |
| FAILED on conversion error      | .docx file, mock S3 returns corrupt data | status FAILED                                                                |
| idempotency skip                | status already COMPLETE                  | S3 download not called                                                       |
| smart typography applied        | .txt with straight quotes                | content has smart_text marks                                                 |

---

## Files That Should NOT Change

- `apps/web/src/components/manuscripts/manuscript-renderer.tsx` (already consumes ProseMirrorDoc)
- `apps/api/src/services/audit.service.ts` (used as-is)
- `apps/api/src/config/instrumented-worker.ts` (used as-is)
- `packages/db/src/context.ts` (used as-is)

---

## Implementation Sequence

1. Shared types (packages/types) + frontend re-export refactor
2. Schema (enums + manuscripts) + generate migration
3. Audit constants
4. Converters (text, docx, smart-typography, barrel) + unit tests
5. Content extraction service
6. Queue definition + barrel export
7. Worker + barrel export
8. File-scan worker chaining
9. tusd webhook chaining (scan-disabled path)
10. main.ts registration
11. Queue integration test
12. Build + type-check + lint

---

## Verification

1. `pnpm db:reset` — migration applies cleanly
2. `pnpm test` — all unit tests pass (converters + smart typography)
3. `pnpm type-check` — no type errors across workspace
4. `pnpm lint` — no lint warnings
5. Queue integration test — `pnpm vitest run apps/api/src/__tests__/queues/content-extract.queue.test.ts`
6. Manual: upload a .txt file through the submission form, verify `manuscript_versions.content` populates as ProseMirror JSON (requires Docker infra running)
