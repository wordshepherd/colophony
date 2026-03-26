# Manuscript Intermediate Format Specification

> ProseMirror JSON schema for literary manuscripts. Defines how uploaded files (.docx, .pdf, .txt) are converted to a structured, renderable document model.

**Status:** Design specification. No code changes yet — implementation deferred to Step 0b of the design system migration.

**References:**

- [DESIGN_SYSTEM.md Section 8](DESIGN_SYSTEM.md) — Typography system requirements
- [DESIGN_SYSTEM.md Section 7](DESIGN_SYSTEM.md) — Editor workspace, reading position anchoring

---

## 1. Format Choice: ProseMirror JSON

### Why ProseMirror

TipTap (ProseMirror underneath) is already in the Colophony stack for the form builder WYSIWYG editor. ProseMirror's document model is a structured JSON tree with a well-defined schema system and custom node types. Building a second document model alongside one we already maintain creates two sources of truth.

ProseMirror JSON is specifically well-suited for literary content because the schema system allows custom node types that encode literary semantics as first-class citizens — not hacks layered on top of HTML.

### What this enables

- A `poem_line` node that preserves authorial line breaks
- A `stanza_break` node that carries whitespace intent rather than relying on empty paragraphs
- A `section_break` node for creative nonfiction that distinguishes structural breaks from decorative ones
- Genre-aware rendering strategies selected by a document-level attribute
- Non-destructive smart typography via ProseMirror's transform system

---

## 2. Custom Schema Definition

### Document-level attributes

Stored on the top-level `doc` node:

| Attribute                  | Type                                                                        | Description                                                                                |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `genre_hint`               | `'prose' \| 'poetry' \| 'hybrid' \| 'creative_nonfiction'`                  | From submission form (writer selects); editor-overridable                                  |
| `submission_metadata`      | `{ originalFilename: string, originalFormat: string, convertedAt: string }` | Provenance — what was uploaded and when it was converted                                   |
| `smart_typography_applied` | `boolean`                                                                   | Whether the smart typography pass has been applied (drives the "show as submitted" toggle) |

### Node types

#### Prose nodes

| Node            | Attributes        | Content  | Description                                                                                                                                              |
| --------------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paragraph`     | `indent: boolean` | inline\* | Standard paragraph. `indent: true` for all paragraphs except the first in a section (book-style indent, not block spacing).                              |
| `section_break` | —                 | empty    | Structural break between sections. Renders as whitespace (not a decorative `<hr>`). Distinguishes intentional section boundaries from arbitrary spacing. |
| `block_quote`   | —                 | block+   | Block quotation. Preserves nesting.                                                                                                                      |

#### Poetry nodes

| Node               | Attributes      | Content        | Description                                                                                                                                                      |
| ------------------ | --------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `poem_line`        | —               | inline\*       | A single line of poetry. Preserves the authorial line break — the renderer never wraps or joins these.                                                           |
| `stanza_break`     | —               | empty          | Whitespace between stanzas. Carries intent: this is a deliberate poetic pause, not an empty paragraph.                                                           |
| `preserved_indent` | `depth: number` | inline\*       | A line with preserved indentation (tabs and spaces normalized to a computed depth). For dropped lines, stepped indentation, and other spatial poetry techniques. |
| `caesura`          | `width: number` | empty (inline) | Mid-line spacing for precise prosody. Optional — for publications that care about caesura placement. `width` is in em units.                                     |

#### Shared nodes

| Node                   | Attributes | Content  | Description                                                                                                         |
| ---------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `preserved_whitespace` | —          | inline\* | For experimental formatting that doesn't fit prose or poetry conventions. Renders with `white-space: pre` behavior. |

### Mark types

| Mark         | Attributes         | Description                                                                                                                                                                                                               |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `emphasis`   | —                  | Italic text.                                                                                                                                                                                                              |
| `strong`     | —                  | Bold text.                                                                                                                                                                                                                |
| `small_caps` | —                  | Small caps. Rendered via CSS `font-variant: small-caps`.                                                                                                                                                                  |
| `smart_text` | `original: string` | Applied to text that has been smart-typography normalized. The `original` attribute carries the as-submitted text. When "show as submitted" is toggled, the renderer reads `original` instead of the node's text content. |

---

## 3. Dual-Form Storage

### Problem

The design system requires a smart typography pass (straight quotes to curly, hyphens to em dashes) but also requires a bypass — some writers use these intentionally.

### Solution

The ProseMirror document stores two representations simultaneously:

- **Normalized text** — stored as the node's text content (default render)
- **Original text** — stored as the `original` attribute on the `smart_text` mark

The renderer checks the document-level `smart_typography_applied` toggle:

- When `true` (default): render node text content (normalized)
- When `false` ("show as submitted"): for any text node with a `smart_text` mark, render the mark's `original` attribute instead

### Example

A writer submits: `She said -- "it's fine."`

After smart typography pass, the ProseMirror JSON stores:

```json
{
  "type": "text",
  "text": "She said \u2014 \u201cit\u2019s fine.\u201d",
  "marks": [
    {
      "type": "smart_text",
      "attrs": { "original": "She said -- \"it's fine.\"" }
    }
  ]
}
```

Only text nodes where normalization actually changed something carry the `smart_text` mark. Unchanged text has no mark and renders identically in both modes.

### Smart typography rules

| Input                       | Output                    | Notes                                                                  |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `"` / `'` (straight quotes) | `"` `"` / `'` `'` (curly) | Context-sensitive: opening after space/start, closing before space/end |
| `--` (double hyphen)        | `—` (em dash)             |                                                                        |
| `---` (triple hyphen)       | `—` (em dash)             | Same as double; some writers use triple                                |
| `...` (three dots)          | `…` (ellipsis)            |                                                                        |
| `Mr.`, `Mrs.`, etc.         | No change                 | Common abbreviations excluded from ellipsis rule                       |

---

## 4. Conversion Pipeline

### Architecture

```
File upload → tusd → ClamAV scan → CLEAN
                                      ↓
                              content-extract job (new BullMQ worker)
                                      ↓
                              ProseMirror JSON → store in DB (manuscript_versions.content)
```

The content extraction job chains after the file scan worker marks a file as CLEAN. It reads from the S3/Garage clean bucket.

### Format-specific converters

| Source format | Converter                                              | Approach                                                                                        | Fidelity                                          |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `.txt`        | Direct parse                                           | Split on newlines, apply genre-hint heuristics                                                  | High (what you see is what you get)               |
| `.md`         | Remark/unified                                         | Parse Markdown AST → map to ProseMirror nodes                                                   | High                                              |
| `.docx`       | mammoth.js → HTML → ProseMirror                        | mammoth preserves paragraph structure + inline formatting; ProseMirror `DOMParser` ingests HTML | Medium-high (loses some Word-specific formatting) |
| `.rtf`        | rtf-parser or libreoffice-convert → HTML → ProseMirror | RTF is complex; library coverage varies                                                         | Medium                                            |
| `.pdf`        | pdf-parse (text extraction) → plain text → ProseMirror | PDF doesn't encode semantic structure; line breaks are approximate                              | Low (lossy, especially for poetry)                |

### Genre-hint-driven node mapping

The genre hint (from the submission form) tells the converter how to interpret structural elements:

- **Prose**: paragraphs become `paragraph` nodes, blank lines become `section_break` nodes, block quotes preserved
- **Poetry**: paragraphs become `poem_line` nodes, blank lines become `stanza_break` nodes, leading whitespace becomes `preserved_indent` with computed depth
- **Hybrid**: heuristic: short lines (< 60 chars, consistently) treated as poetry; longer blocks treated as prose. Section breaks partition the two.
- **Creative nonfiction**: treated as prose, but multiple consecutive blank lines are preserved as structural whitespace

For `.docx`, mammoth.js preserves paragraph-level structure which maps naturally. For `.txt`, line breaks are the only structural signal.

### Pipeline steps (per file)

1. Read file from S3 clean bucket
2. Detect format by MIME type / extension
3. Run format-specific converter → raw ProseMirror JSON
4. Apply genre-hint node mapping (if converter produced generic paragraphs)
5. Run smart typography pass (producing `smart_text` marks where changes occurred)
6. Store result as JSONB in `manuscript_versions.content`
7. Update `content_extraction_status` to COMPLETE

### Error handling

- Unsupported format (images, audio, video): set status to `UNSUPPORTED`, no content extracted
- Conversion failure: set status to `FAILED`, log error, allow manual retry
- PDF with no extractable text: set status to `COMPLETE` but flag content as `approximate` in metadata

---

## 5. Schema Changes (Deferred to Implementation)

New columns on `manuscript_versions` table:

| Column                      | Type          | Description                                                  |
| --------------------------- | ------------- | ------------------------------------------------------------ |
| `content`                   | `jsonb`       | ProseMirror JSON document                                    |
| `content_format`            | `varchar(50)` | Format version identifier (initially `'prosemirror_v1'`)     |
| `content_extraction_status` | `enum`        | `PENDING \| EXTRACTING \| COMPLETE \| FAILED \| UNSUPPORTED` |

The `content` column is nullable — files uploaded before the pipeline exists will have `null` content and `PENDING` status. A backfill job can process existing files.

---

## 6. Security and Runtime Integration

The content-extract worker must follow the same patterns as the existing file-scan worker (`apps/api/src/workers/file-scan.worker.ts`):

- **RLS context**: Carry `userId` in the job data. Use `withRls()` for all DB writes (SET LOCAL inside transactions, never session-level SET).
- **Worker registration**: Register in `apps/api/src/main.ts` alongside existing workers.
- **Status transitions**: Follow the same PENDING → EXTRACTING → COMPLETE/FAILED pattern as `scanStatus`.
- **Audit logging**: Log content extraction events (success with format/size, failure with error, unsupported format skip).
- **Idempotency**: Check `content_extraction_status` before processing. If already COMPLETE, skip.
- **Chaining**: Triggered by the file-scan worker's `onCompleted` event (or a separate queue that the scan worker enqueues to on CLEAN).

---

## 7. Content Anchoring

Reading position is stored per workspace item (see `workspace_items.reading_anchor` in DESIGN_SYSTEM.md Section 7).

### Anchor format

```typescript
interface ReadingAnchor {
  nodeIndex: number; // Sequential index of the top-level block node
  charOffset: number; // Character offset within that node's text content
}
```

- `nodeIndex`: 0-based index into the document's top-level children (paragraph, poem_line, section_break, etc.)
- `charOffset`: 0-based character offset within the text content of that node (0 = start of node)

### Why content-anchored

A scroll offset (pixels from top) is fragile — it breaks on font size changes, window resizes, and browser updates. A content anchor references the document structure, which is stable regardless of rendering geometry.

### Resolution

The renderer resolves a `ReadingAnchor` to a DOM position:

1. Walk the document's top-level nodes to find `nodeIndex`
2. Find the corresponding DOM element
3. Scroll it into view, offset by character position if needed

ProseMirror's `ResolvedPos` API can assist, but a simpler sequential walk over rendered nodes is sufficient for scroll-to behavior.

---

## 8. UI Integration Points

### Existing reading mode

`apps/web/src/components/submissions/submission-detail.tsx` already has a reading-mode toggle path (~lines 104, 427). This is the primary integration point for the `ManuscriptRenderer` component.

The renderer should:

1. Check if `manuscript_versions.content` is available (non-null, status COMPLETE)
2. If available: render ProseMirror JSON with genre-aware typography
3. If not available: fall back to current behavior (file download links)

### ManuscriptRenderer component (future)

Location: `apps/web/src/components/manuscripts/manuscript-renderer.tsx`

Props:

- `content`: ProseMirror JSON document
- `genreHint`: override for the document-level genre hint
- `showAsSubmitted`: toggle for smart typography bypass
- `onAnchorChange`: callback when reading position changes (for workspace persistence)
- `initialAnchor`: ReadingAnchor to scroll to on mount

The renderer ignores density context (per DESIGN_SYSTEM.md Section 3) — it always renders at reading-quality typography.

---

## 9. Known Limitations and Hard Problems

### PDF extraction is lossy

PDF doesn't encode semantic structure. Poetry line breaks may be lost or conflated with word-wrap breaks. Page breaks may appear as content breaks.

**Mitigation:** Flag PDF-extracted content with an `approximate: true` metadata field. Surface a subtle indicator in the UI ("Extracted from PDF — formatting may differ from the original"). Allow editors to correct via a future editing interface.

### .docx poetry detection

mammoth.js preserves paragraph structure but doesn't distinguish prose paragraphs from poem lines. A .docx with one paragraph per line could be prose with short sentences or poetry.

**Mitigation:** The genre hint from the submission form is the primary signal. Heuristics (short lines < 60 chars, consistent line lengths, no trailing punctuation) can assist. Editor override is essential — the UI should make it easy to switch between prose and poetry rendering for any piece.

### Tab/space normalization for poetry

.docx stores tabs and spaces differently. A poem with tab-based indentation and the same poem with space-based indentation must produce identical `preserved_indent` nodes.

**Mitigation:** The .docx converter must:

1. Detect leading whitespace in each paragraph
2. Normalize tabs to a configurable number of spaces (default: 4)
3. Compute indent depth as `floor(leading_spaces / indent_unit)`
4. Store as `preserved_indent` node with `depth` attribute

This requires testing with real poetry manuscripts from diverse word processors.

### Rich formatting preservation

| Format  | Bold/italic                  | Small caps                            | Custom fonts     |
| ------- | ---------------------------- | ------------------------------------- | ---------------- |
| `.docx` | Preserved (mammoth.js)       | Partially (depends on .docx encoding) | Lost (by design) |
| `.rtf`  | Preserved (with good parser) | Rare                                  | Lost             |
| `.pdf`  | Lost (text extraction only)  | Lost                                  | Lost             |
| `.txt`  | N/A                          | N/A                                   | N/A              |

Small caps are particularly important for literary magazines. mammoth.js can detect `<w:smallCaps/>` in .docx XML, but this requires a custom style mapping rule.

---

## 10. Prototype Scope

The first implementation should validate the end-to-end pipeline with minimal scope:

1. **`.txt` converter** — Simplest format. Validates the schema, pipeline, and renderer end-to-end.
2. **`.docx` converter** via mammoth.js — Covers the most common submission format.
3. **Smart typography pass** with dual-form `smart_text` marks.
4. **Basic `ManuscriptRenderer`** consuming ProseMirror JSON — prose genre only, reading-quality typography.
5. **Content extraction BullMQ worker** — chained after file scan, with RLS context and status transitions.
6. **Schema migration** — add `content`, `content_format`, `content_extraction_status` columns.

**Deferred to second iteration:**

- Poetry-specific rendering (poem_line, stanza_break, preserved_indent, caesura)
- Genre-hint switching in the renderer
- "Show as submitted" toggle UI
- PDF and RTF converters
- Content anchor persistence and scroll-to behavior
- Editor-side genre override
- Backfill job for existing manuscripts
