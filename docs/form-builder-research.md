# Form Builder Architecture Research — Colophony (Hopper)

Research document for implementing a drag-and-drop form builder for literary magazine submission intake forms.

**Date:** 2026-02-11
**Context:** Hopper (Colophony's submission management component) needs a Submittable-level form builder with 15 field types, conditional logic, file uploads, and embeddable forms.

---

## Table of Contents

1. [JSON Schema-Based Form Definition](#1-json-schema-based-form-definition)
2. [Open-Source Form Builder Evaluation](#2-open-source-form-builder-evaluation)
3. [Drag-and-Drop Implementation](#3-drag-and-drop-implementation)
4. [Conditional Logic Engine Design](#4-conditional-logic-engine-design)
5. [Embeddable Form Widget](#5-embeddable-form-widget)
6. [File Upload Integration](#6-file-upload-integration)
7. [Accessibility (WCAG)](#7-accessibility-wcag)
8. [Proposed Form Schema Design](#8-proposed-form-schema-design)
9. [Architecture Recommendation](#9-architecture-recommendation)

---

## 1. JSON Schema-Based Form Definition

### Standards Overview

| Standard                   | Status                   | Key Features                                                    | Form Suitability                                |
| -------------------------- | ------------------------ | --------------------------------------------------------------- | ----------------------------------------------- |
| JSON Schema draft-07       | Stable, widely adopted   | Simple vocabulary, broad tooling                                | Good for data validation; limited for UI/layout |
| JSON Schema 2020-12        | Latest stable            | `$dynamicRef`, `prefixItems`, vocabulary system                 | Better extensibility, but still data-focused    |
| JSON Forms (EclipseSource) | Separate project         | Decoupled data schema + UI schema                               | Excellent separation of concerns                |
| Form.io Schema             | Proprietary-ish standard | Components array, recursive nesting, conditional logic built-in | Purpose-built for forms                         |

### React JSON Schema Form (RJSF) vs JSON Forms

| Dimension             | RJSF                                                                  | JSON Forms                                                                         |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Schema approach**   | Single JSON Schema + optional `uiSchema`                              | Separate data schema + UI schema (strict separation)                               |
| **Framework support** | React only                                                            | React, Angular, Vue                                                                |
| **Theme support**     | Bootstrap 3/4, MUI 4/5, Fluent UI, Ant Design, Chakra UI, Semantic UI | Material UI, Vanilla; custom renderers                                             |
| **Customization**     | Widgets + custom fields                                               | Custom renderers (more granular control)                                           |
| **Layout control**    | Basic (via `uiSchema` with `ui:order`, `ui:widget`)                   | Rich (groups, tabs, categorization, horizontal/vertical layouts)                   |
| **Conditional logic** | Limited (via `dependencies` in JSON Schema)                           | Rule-based (`rule` property in UI schema with `SHOW`, `HIDE`, `ENABLE`, `DISABLE`) |
| **Bundle size**       | ~80KB gzipped (core)                                                  | ~45KB gzipped (core)                                                               |
| **Community**         | Larger (14K+ GitHub stars)                                            | Smaller (2K+ stars) but backed by EclipseSource                                    |
| **Maturity**          | Very mature, but can feel dated                                       | Modern, actively maintained                                                        |

### How Competitors Architect Form Schemas

**Submittable** uses a proprietary drag-and-drop builder that stores form definitions server-side. Forms are composed of fields with field options (auto-labeling, branching logic). Each field type has configurable options. Branching logic enables form fields to appear/disappear based on answers.

**Typeform** uses an internal JSON structure with a blocks-based approach, separating "logic jumps" from field definitions. Forms export as `.json` files. The architecture prioritizes conversational (one-question-at-a-time) UX.

**Tally** uses a Notion-style block-based builder. Forms are stored as arrays of blocks, each with a UUID, type, groupUuid, groupType, and a payload containing the block's data. This modular approach allows flexible composition.

**Form.io** uses a recursive components array where each component has `type`, `key`, `label`, `validate`, and `conditional` properties. Components can contain child components for nested structures. This is the most developer-friendly approach for a platform like Colophony.

### Recommendation: Custom Schema Inspired by Form.io

Adopting a pure JSON Schema standard (draft-07 or 2020-12) is insufficient for form building because JSON Schema was designed for data validation, not form rendering. The layout, field ordering, conditional visibility, and UI-specific metadata (placeholders, help text, field grouping) are not part of the JSON Schema standard.

The best approach for Colophony is a **custom form definition schema** that borrows patterns from Form.io and JSON Forms:

- **Form.io pattern**: Recursive `components` array with `type`, `key`, `label`, `validate`, `conditional` properties. Simple, flat, easy to serialize.
- **JSON Forms pattern**: Separate data schema from UI schema. More architecturally pure but adds complexity.

Given that Colophony's form builder is for non-technical magazine editors and the forms are relatively simple (12-15 field types, not deeply nested enterprise forms), the **Form.io-style flat components array** is the better fit. It is simpler to build a drag-and-drop UI for, simpler to serialize/deserialize, and simpler to validate.

---

## 2. Open-Source Form Builder Evaluation

### Comparison Matrix

| Platform       | License                               | Use as Library?          | DnD Builder?     | Schema Format      | Conditional Logic?    | File Upload? | Self-Hostable?          | Tech Stack                      |
| -------------- | ------------------------------------- | ------------------------ | ---------------- | ------------------ | --------------------- | ------------ | ----------------------- | ------------------------------- |
| **SurveyJS**   | MIT (renderer) / Commercial (creator) | Yes (designed for it)    | Yes              | Proprietary JSON   | Yes (advanced)        | Yes          | Yes                     | Vanilla JS + framework bindings |
| **Formbricks** | MIT                                   | No (standalone product)  | Yes              | Internal           | Yes                   | Limited      | Yes                     | Next.js, Prisma, Tailwind       |
| **Form.io**    | MIT (core) / Commercial (enterprise)  | Yes (renderer + builder) | Yes              | Form.io JSON       | Yes (JSON Logic)      | Yes          | Yes (community edition) | Vanilla JS + Angular/React      |
| **Typebot**    | FSL (restrictive)                     | No (standalone product)  | Yes              | Internal           | Yes (conversational)  | Limited      | Yes                     | Next.js, Prisma, Chakra UI      |
| **HeyForm**    | AGPL-3.0                              | No (standalone product)  | Yes              | Internal (MongoDB) | Yes                   | Yes          | Yes                     | Node, React, MongoDB            |
| **Tripetto**   | Free (CLI) / Commercial (embedded)    | Yes (SDK)                | Yes (storyboard) | Proprietary JSON   | Yes (flowchart-based) | Limited      | No (SaaS)               | Vanilla JS + framework bindings |

### Detailed Evaluation

#### SurveyJS — Best Library Option (But Commercial)

**Strengths:**

- Purpose-built as an embeddable library, not a standalone product. This is exactly what Colophony needs.
- True React components (not DOM manipulation wrappers).
- Separation of business logic (`survey-core`) from rendering. Business logic is framework-agnostic.
- Rich field types (30+), conditional logic, calculated values, validation, and themes.
- Drag-and-drop builder ("Survey Creator") available as React component.
- Renderer is MIT-licensed. Builder requires a commercial license.
- Royalty-free distribution. No per-end-user fees.
- Supports custom question types and third-party component integration.

**Weaknesses:**

- Builder (Survey Creator) requires commercial license (~$570/developer/year).
- Schema format is proprietary to SurveyJS, creating vendor lock-in.
- Heavy bundle size when including the full creator.
- Styling system uses its own theming, not Tailwind/shadcn natively.

**Verdict:** If budget allows, SurveyJS is the fastest path to a production-quality form builder. The renderer (MIT) can be used for free for rendering submitted forms. The builder requires a license. For a self-hosted open-source product like Colophony, the commercial builder license creates an uncomfortable dependency. The renderer could be used as a rendering backend while building a custom builder UI.

#### Formbricks — Closest Architecture Match (But Not a Library)

**Strengths:**

- Nearly identical tech stack to Colophony: Next.js, Prisma, Tailwind, TypeScript.
- Strong privacy-first / GDPR-compliant design.
- Modern, clean UI with Tailwind + Radix primitives.
- MIT licensed.
- Self-hostable via Docker.

**Weaknesses:**

- Designed as a standalone survey/experience-management product, not an embeddable library.
- Extracting the form builder components from Formbricks and integrating them into Colophony would require significant effort and create a maintenance burden.
- Focused on surveys/feedback collection, not structured submission intake.
- Missing literary-submission-specific features (file uploads for manuscripts, cover letters).

**Verdict:** Formbricks is architecturally instructive (study its code for patterns) but not suitable as a dependency. It would need to be forked and heavily modified, which is worse than building custom.

#### Form.io — Best Open-Source Schema Design (But MongoDB-Dependent)

**Strengths:**

- Mature, battle-tested form schema design.
- Open-source community edition with builder + renderer.
- Embeddable renderer (single line of JavaScript).
- JSON Logic for conditional fields.
- Multiple renderer frameworks (React, Angular, Vue, Vanilla).
- No iframes needed for embedding.

**Weaknesses:**

- Architecture depends on MongoDB, not PostgreSQL. Colophony uses PostgreSQL.
- Community edition is limited. Enterprise features (e.g., multi-tenancy, form versioning) require paid license.
- The JavaScript renderer (`formio.js`) is framework-agnostic but uses DOM manipulation, not React components. Integration with React/Next.js feels like an afterthought.
- Heavy bundle size.

**Verdict:** Form.io's schema design is excellent and should be studied. Its renderer could theoretically be used for embedded forms on external sites. However, the MongoDB dependency and non-React-native rendering make it a poor fit as a core dependency. **Adopt its schema patterns, not its code.**

#### Typebot — Wrong Paradigm

**Strengths:** Beautiful conversational UI, good self-hosting story.
**Weaknesses:** Conversational (one-question-at-a-time) paradigm is wrong for literary submissions. Writers need to see the full form. FSL license is restrictive.
**Verdict:** Not suitable.

#### HeyForm — MongoDB-Dependent, AGPL License

**Strengths:** Good feature set, AI-powered form creation, modern UI.
**Weaknesses:** MongoDB + KeyDB stack (incompatible with Colophony's PostgreSQL + Redis). AGPL license requires derivative works to be open-source (fine for Colophony, but limits future SaaS flexibility). Limited community.
**Verdict:** Not suitable as a dependency.

#### Tripetto — Instructive Architecture (But Commercial)

**Strengths:** Clean three-pillar architecture (Builder + Runner + Blocks). Headless runner engine. Modular block system for question types. React components available.
**Weaknesses:** Commercial license required for embedded builder. Proprietary schema format. Not open-source for production use.
**Verdict:** Study the architecture (Builder/Runner/Blocks separation is excellent) but do not use as a dependency.

### Summary Recommendation

**Build custom, informed by SurveyJS architecture and Form.io schema design.**

- Use Form.io's JSON schema patterns for the form definition format.
- Use Tripetto's Builder/Runner/Blocks architecture as the structural model.
- Use SurveyJS's MIT-licensed renderer as a reference implementation for the form renderer.
- Build a custom drag-and-drop builder UI using dnd-kit + shadcn/ui components.

This approach gives Colophony full control over the form builder, no license dependencies, and a schema format optimized for literary submissions.

> **Note (2026-02-15):** Reviewed external feedback suggesting JSON Forms or RJSF for "renderer-heavy paths." Decision: keep custom builder and renderer for submission forms (product-differentiating — tus/ClamAV integration, submission periods, blind submission toggles). If we later build many generic admin/settings forms (org config, publication settings), evaluate JSON Forms as a renderer for those non-domain-specific forms to reduce maintenance. No action needed now.

---

## 3. Drag-and-Drop Implementation

### Library Comparison

| Library                       | Bundle Size   | Accessibility                             | Keyboard DnD                             | Maintenance               | API Style              | Best For                                 |
| ----------------------------- | ------------- | ----------------------------------------- | ---------------------------------------- | ------------------------- | ---------------------- | ---------------------------------------- |
| **dnd-kit**                   | ~12KB gzipped | Built-in ARIA, keyboard sensor            | Native, with sortableKeyboardCoordinates | Uncertain (see below)     | Hooks-based            | Form builders, sortable lists            |
| **@hello-pangea/dnd**         | ~30KB gzipped | Good (inherited from react-beautiful-dnd) | Built-in                                 | Active (community fork)   | Component-based        | Kanban boards, simple lists              |
| **react-dnd**                 | ~20KB gzipped | Manual (no built-in)                      | Manual implementation                    | Stable but slow           | Hooks + HOC            | Complex cross-container DnD              |
| **Pragmatic DnD** (Atlassian) | ~5KB gzipped  | Optional package                          | Optional React package                   | Active (Atlassian-backed) | Headless/adapter-based | Performance-critical, framework-agnostic |

### Detailed Analysis for Form Builder Use Case

#### dnd-kit (Recommended)

**Why it is the best fit for a form builder:**

1. **Sortable preset** (`@dnd-kit/sortable`) is purpose-built for reordering lists, which is exactly what a form builder needs (dragging fields into position).
2. **Built-in keyboard accessibility** with `KeyboardSensor` and `sortableKeyboardCoordinates`. Users can pick up items with Space, move with arrow keys, and drop with Space. This is essential for WCAG compliance.
3. **Hooks-based API** integrates naturally with React functional components and the existing shadcn/ui component patterns in Colophony.
4. **Lightweight** at ~12KB gzipped.
5. **Two-zone pattern**: Supports dragging items from a "palette" (field type list) into a "canvas" (form builder area), which is the core UX pattern for form builders.
6. **Existing form builder examples**: The dnd-kit community has shared form builder implementations (GitHub Discussion #639).

**Maintenance concern:** There is an open GitHub issue (#1194) questioning the future of dnd-kit's maintenance. The maintainer (clauderic) has been less active since 2023. However, the library is stable for the current use case (sortable lists), and there is a v1 rewrite in progress. The current stable version works well and is unlikely to need significant patches for a form builder.

**Mitigation:** dnd-kit's API surface for sortable lists is small and well-documented. If maintenance stalls completely, the library could be vendored (copied into the project) or replaced with Pragmatic DnD without major refactoring, since both use a hooks-based pattern.

#### Pragmatic Drag and Drop (Strong Alternative)

**Strengths for form builders:**

- Backed by Atlassian, used in Jira/Confluence. Unlikely to be abandoned.
- Smallest bundle size (~5KB).
- Framework-agnostic core with optional React package.
- Comprehensive accessibility guidelines and optional `@atlaskit/pragmatic-drag-and-drop-react-accessibility` package providing keyboard interactions (Space to pick up, arrows to move, Enter to drop).

**Weaknesses:**

- Newer library with less community adoption for form builders specifically.
- No built-in sortable preset; requires more manual implementation for the reorder behavior.
- Documentation and community examples are less extensive than dnd-kit for the form builder use case.

**Verdict:** Strong backup option. If dnd-kit maintenance becomes untenable, Pragmatic DnD is the migration target.

#### @hello-pangea/dnd (Not Recommended)

- Good for simple list reordering, but imposes strict constraints on the drag container.
- Requires importing the entire package (no tree-shaking).
- Performance overhead for complex layouts.
- The "field palette to form canvas" drag pattern (cross-container) is awkward with this library.

#### react-dnd (Not Recommended)

- Most flexible, but requires the most manual work.
- No built-in accessibility. Keyboard DnD must be implemented from scratch.
- HTML5 backend does not support touch devices well without additional backends.
- Overkill for a form builder's relatively simple DnD needs.

### Recommended Architecture

```
Form Builder UI
├── FieldPalette (left sidebar)
│   ├── Draggable field type cards (text, textarea, select, etc.)
│   └── Uses @dnd-kit/core DragOverlay for drag preview
├── FormCanvas (center)
│   ├── Uses @dnd-kit/sortable for field reordering
│   ├── Droppable zone that accepts items from FieldPalette
│   └── Each field renders as a SortableItem with drag handle
├── FieldProperties (right sidebar)
│   ├── Selected field configuration
│   ├── Validation rules
│   └── Conditional logic rules
└── FormPreview (toggle/tab)
    └── Renders the form as submitters will see it
```

**Key packages:**

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

---

## 4. Conditional Logic Engine Design

### Requirements

Literary magazine forms need relatively simple conditional logic:

- Show/hide a field based on another field's value (e.g., show "Genre" dropdown when Category = "Fiction")
- Show/hide a section based on a field value
- Enable/disable a field based on conditions
- Chain conditions with AND/OR logic
- Evaluate conditions client-side in real-time as the submitter fills the form

### Approach Comparison

| Approach                                    | Complexity | Performance                       | Serializable?            | Ecosystem                         |
| ------------------------------------------- | ---------- | --------------------------------- | ------------------------ | --------------------------------- |
| **JSON Logic** (`json-logic-js`)            | Medium     | Good for simple rules             | Yes (pure JSON)          | Mature, multi-language support    |
| **JSON Logic Engine** (`json-logic-engine`) | Medium     | 5-20x faster than `json-logic-js` | Yes (pure JSON)          | Newer, TypeScript, compiled rules |
| **Custom rule engine**                      | Low-Medium | Best (no overhead)                | Yes (custom JSON format) | None                              |
| **JavaScript expressions** (eval)           | High       | Good                              | No (security risk)       | N/A (do not use)                  |

### Recommended: Custom Rule Engine with JSON Logic Syntax

For Colophony's use case, a **custom lightweight rule engine** that uses a subset of JSON Logic syntax is the best approach. Full JSON Logic is more powerful than needed (it supports arithmetic, string operations, array operations, etc.), and the custom engine can be optimized for the specific patterns used in form conditional logic.

#### Rule Definition Format

```typescript
interface ConditionalRule {
  /** What happens when the condition is met */
  effect: "SHOW" | "HIDE" | "ENABLE" | "DISABLE" | "REQUIRE";
  /** The condition to evaluate */
  condition: RuleCondition;
}

interface RuleCondition {
  /** Logical operator for combining multiple conditions */
  operator: "AND" | "OR";
  /** Individual conditions */
  rules: SingleCondition[];
}

interface SingleCondition {
  /** The field key to check */
  field: string;
  /** Comparison operator */
  comparator:
    | "eq"
    | "neq"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "is_empty"
    | "is_not_empty"
    | "in"
    | "not_in";
  /** The value to compare against */
  value: string | number | boolean | string[];
}
```

#### Example: Show "Genre" When Category Is "Fiction"

```json
{
  "effect": "SHOW",
  "condition": {
    "operator": "AND",
    "rules": [
      {
        "field": "category",
        "comparator": "eq",
        "value": "fiction"
      }
    ]
  }
}
```

#### Evaluation Engine (TypeScript)

```typescript
function evaluateCondition(
  condition: RuleCondition,
  formValues: Record<string, unknown>,
): boolean {
  const results = condition.rules.map((rule) => {
    const fieldValue = formValues[rule.field];
    switch (rule.comparator) {
      case "eq":
        return fieldValue === rule.value;
      case "neq":
        return fieldValue !== rule.value;
      case "contains":
        return String(fieldValue).includes(String(rule.value));
      case "is_empty":
        return !fieldValue || fieldValue === "";
      case "is_not_empty":
        return !!fieldValue && fieldValue !== "";
      case "in":
        return (
          Array.isArray(rule.value) && rule.value.includes(fieldValue as string)
        );
      case "not_in":
        return (
          Array.isArray(rule.value) &&
          !rule.value.includes(fieldValue as string)
        );
      // ... other comparators
      default:
        return false;
    }
  });

  return condition.operator === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
}
```

#### Performance Considerations

- **Debounce evaluation**: Do not re-evaluate all rules on every keystroke. Debounce text input by 150ms; evaluate immediately for select/radio/checkbox changes.
- **Dependency graph**: Build a directed graph of field dependencies at form load time. When a field value changes, only re-evaluate rules that depend on that field.
- **Early exit**: For AND conditions, stop evaluating after the first `false`. For OR conditions, stop after the first `true`.
- **Memoization**: Cache evaluation results per field value combination. Invalidate only when a dependency changes.

For Colophony's forms (typically 10-30 fields with 0-10 conditional rules), performance is not a concern. Even a naive implementation evaluating all rules on every change would complete in under 1ms.

#### Rule Builder UI

The rule builder UI for editors should use a visual pattern similar to email filter builders:

```
When [field dropdown] [comparator dropdown] [value input]
  AND/OR
When [field dropdown] [comparator dropdown] [value input]
  Then [SHOW/HIDE/REQUIRE] this field
```

This is simple enough for non-technical magazine editors to understand. Each field in the form builder's properties panel would have a "Conditional Logic" section that expands to show this rule builder when toggled on.

---

## 5. Embeddable Form Widget

### Requirements

Magazines need to embed submission forms on their own websites (WordPress, Squarespace, custom sites). The embed must:

1. Render the form correctly regardless of the host site's CSS.
2. Handle authentication (the submitter needs a Colophony account).
3. Handle file uploads (tus protocol).
4. Submit form data to the Colophony API.
5. Be simple to embed (one script tag or one-line embed code).

### Approach Comparison

| Approach                       | Style Isolation     | Auth UX                       | Bundle Size   | Host Compatibility | Complexity |
| ------------------------------ | ------------------- | ----------------------------- | ------------- | ------------------ | ---------- |
| **iframe**                     | Complete            | Redirect to login or popup    | Minimal (URL) | Universal          | Low        |
| **Web Component + Shadow DOM** | Good (CSS isolated) | Token in postMessage or popup | 100-200KB     | Modern browsers    | Medium     |
| **React bundle (IIFE)**        | Manual (scoped CSS) | Same as Web Component         | 150-300KB     | Modern browsers    | Medium     |
| **iframe + postMessage**       | Complete            | popup/redirect                | Minimal       | Universal          | Low-Medium |

### Recommended: iframe with Progressive Enhancement

For the MVP embeddable form, an **iframe** is the correct choice. Here is the rationale:

#### Why iframe wins for literary magazine embeds

1. **Complete style isolation.** Magazine websites have wildly varied CSS (WordPress themes, custom designs, Squarespace templates). Shadow DOM provides CSS isolation, but CSS custom properties and certain global styles can still leak in. An iframe provides complete isolation.

2. **Authentication simplicity.** The iframe loads a page on `forms.colophony.app` (or the self-hosted domain). Authentication happens within the iframe via the same login flow as the main app. No cross-origin token passing needed.

3. **Security.** The form runs in its own browsing context. The host page cannot access form data, and the form cannot access the host page. This is important for GDPR compliance.

4. **Simplicity for magazine editors.** The embed code is one line:

   ```html
   <iframe
     src="https://submit.magazine.com/forms/fiction-2025"
     width="100%"
     height="800"
     frameborder="0"
     allow="camera; microphone"
     style="border: none; max-width: 720px;"
   ></iframe>
   ```

5. **File uploads work natively.** The tus upload client runs inside the iframe, connecting to the Colophony API. No cross-origin complications.

#### iframe Drawbacks and Mitigations

| Drawback                      | Mitigation                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fixed height (no auto-resize) | Use `postMessage` to communicate content height from iframe to parent. Provide a small JavaScript snippet alongside the iframe. |
| SEO (content not indexed)     | Not relevant for submission forms. Forms are behind authentication.                                                             |
| Mobile responsiveness         | The iframe `src` page is a responsive React page. Set `width="100%"` on the iframe.                                             |
| Double scrollbar              | Auto-resize with `postMessage` eliminates this.                                                                                 |

#### Auto-Resize Implementation

```html
<!-- Magazine's website -->
<iframe
  id="colophony-form"
  src="https://submit.magazine.com/forms/fiction-2025"
  width="100%"
  frameborder="0"
  style="border:none; overflow:hidden;"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data.type === "colophony-resize") {
      document.getElementById("colophony-form").style.height =
        e.data.height + "px";
    }
  });
</script>
```

```typescript
// Inside the iframe (Colophony form page)
const observer = new ResizeObserver((entries) => {
  const height = entries[0].contentRect.height;
  window.parent.postMessage({ type: "colophony-resize", height }, "*");
});
observer.observe(document.body);
```

#### Future: Web Component Upgrade Path

For Phase 2 (SaaS), consider adding a Web Component wrapper around the iframe for a cleaner developer experience:

```html
<script src="https://cdn.colophony.app/embed.js"></script>
<colophony-form
  org="literary-review"
  form="fiction-2025"
  theme="light"
></colophony-form>
```

The Web Component internally creates an iframe but handles auto-resize, theming via query params, and postMessage communication automatically. This provides a better developer experience while maintaining the isolation benefits of iframes.

#### Theming

The embedded form should support basic theming via URL parameters or a configuration object:

- `?theme=light|dark`
- `?primaryColor=%23007bff`
- `?fontFamily=Georgia`
- `?borderRadius=8`

The form page reads these params and applies them as CSS custom properties. This lets magazines match the form to their site's design.

---

## 6. File Upload Integration

### Current Architecture

Colophony already has a mature file upload pipeline:

1. `tus-js-client` on the frontend (in `use-file-upload.ts` hook)
2. `tusd` sidecar for resumable uploads
3. Pre-create hook for validation (auth, quota, file type)
4. Post-finish hook creates `SubmissionFile` record
5. BullMQ job for ClamAV virus scanning
6. Clean files move to production bucket; infected files are quarantined

### Form Builder File Upload Fields

In the form builder context, file upload fields need to be treated differently from simple form fields:

#### Architecture

```
FormField (type: "file_upload")
├── Configuration (set by editor in builder)
│   ├── allowedTypes: ["application/pdf", "application/msword", ...]
│   ├── maxFileSize: 50MB (default from ALLOWED_MIME_TYPES)
│   ├── maxFiles: 1-10
│   ├── required: boolean
│   └── label: "Upload your manuscript"
└── Runtime (submitter experience)
    ├── FileUploadField component (wraps existing FileUpload component)
    ├── Shows upload progress, scan status
    ├── Files are uploaded immediately when selected (not on form submit)
    └── File IDs are stored in the form response data
```

#### Two-Phase Submission Pattern

File uploads should not wait for form submission. The recommended pattern:

1. **Form creation**: When a submitter starts filling out a form, create a draft `Submission` record immediately (or use a temporary upload context).
2. **File upload**: When the submitter selects a file, upload it immediately via tus. Associate the file with the submission/context.
3. **Form submission**: When the submitter clicks "Submit," validate the form data (including checking that required file fields have files and all files have passed virus scanning), then finalize the submission.

This is consistent with Colophony's existing pattern where files are uploaded during the edit phase and the submission is finalized separately.

#### Integration with Form Schema

```json
{
  "type": "file_upload",
  "key": "manuscript",
  "label": "Upload Your Manuscript",
  "description": "PDF or Word document, max 50MB",
  "validate": {
    "required": true,
    "maxFiles": 1,
    "allowedTypes": [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    "maxFileSize": 52428800
  }
}
```

#### Form Response Data

File upload field values in the form response are stored as arrays of file references:

```json
{
  "manuscript": [
    {
      "fileId": "uuid-of-submission-file",
      "filename": "my_story.pdf",
      "size": 1234567,
      "scanStatus": "CLEAN"
    }
  ]
}
```

This keeps the form response data lightweight (just references) while the actual files remain in the existing `SubmissionFile` table and MinIO storage.

#### Virus Scanning UX

The form submit button should be disabled if any file field has files with `scanStatus` of `PENDING` or `SCANNING`. Show a message: "Files are being scanned for viruses. Please wait." This matches the existing behavior in `submission-form.tsx`.

---

## 7. Accessibility (WCAG)

### WCAG 2.1 AA Requirements for Form Builder and Rendered Forms

Both the builder UI (for editors) and the rendered forms (for submitters) must meet WCAG 2.1 AA. The requirements differ significantly between the two contexts.

### Form Builder UI (Editor-Facing)

#### Drag-and-Drop Accessibility (WCAG 2.5.7 — Dragging Movements)

WCAG 2.5.7 requires that any functionality that uses dragging movements must also be achievable via a single pointer (click/tap) without dragging. For the form builder:

| DnD Action                        | Keyboard Alternative                                         | Implementation                                           |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Drag field from palette to canvas | Click field in palette to add at end (or at cursor position) | "Add" button on each palette item                        |
| Reorder field by dragging         | Arrow key reordering (move up/down)                          | dnd-kit `KeyboardSensor` + Up/Down buttons on each field |
| Delete field by dragging out      | Delete button / keyboard shortcut                            | Delete button on each field + `Delete` key when focused  |

dnd-kit provides `KeyboardSensor` with `sortableKeyboardCoordinates` out of the box. When a user focuses a drag handle and presses Space, the item enters "picked up" state. Arrow keys move it. Space drops it. Screen readers are informed via live regions.

#### Screen Reader Support

- Each field in the canvas must have an accessible label (`aria-label` or `aria-labelledby`).
- The drag handle must have `role="button"` with `aria-roledescription="sortable"` (dnd-kit provides this).
- Live regions must announce when a field is picked up, moved, and dropped.
- The field palette must be navigable with Tab and have field type names as accessible labels.
- The properties panel must use standard form controls (inputs, selects, checkboxes) with proper labeling.

#### Focus Management

- When a new field is added to the canvas, focus should move to the new field.
- When a field is deleted, focus should move to the next field (or previous if it was the last).
- Tab order in the builder: Palette -> Canvas (field list) -> Properties panel.

### Rendered Forms (Submitter-Facing)

#### Standard Form Accessibility

- Every form field must have a visible `<label>` element with matching `for`/`id` attributes.
- Required fields must have `aria-required="true"` and visual indicators (asterisk with screen-reader text).
- Error messages must be associated with their fields via `aria-describedby` and announced with `aria-live="polite"`.
- Form groups (radio buttons, checkboxes) must use `<fieldset>` and `<legend>`.
- Select inputs must use native `<select>` or Radix UI `Select` (which is accessible).
- Tab order must follow visual order (linear, top-to-bottom).

#### Conditional Fields

When a field is shown/hidden by conditional logic:

- Hidden fields must be removed from the DOM (not just `display: none`) so they are not in the tab order.
- When a field appears, announce it with `aria-live="polite"` on a status region.
- When a field disappears, do not announce (to avoid confusion). Focus should move to the next visible field if the hidden field had focus.

#### File Upload Fields

- File input must have a visible label.
- Upload progress must be announced (use `aria-live="polite"` and/or `role="progressbar"` with `aria-valuenow`).
- Scan status must be announced when it changes.
- Remove-file buttons must be labeled ("Remove file: my_story.pdf").

#### Section Headers

Section headers in the form should use proper heading hierarchy (`<h2>`, `<h3>`) to create a navigable document outline for screen readers.

### Testing Strategy

| Tool                                   | Purpose                                    | When            |
| -------------------------------------- | ------------------------------------------ | --------------- |
| **axe-core** (via `@axe-core/react`)   | Automated WCAG checking                    | CI (unit tests) |
| **Playwright + axe**                   | Automated WCAG checking in browser         | E2E tests       |
| **Manual testing with NVDA/VoiceOver** | Screen reader verification                 | Before release  |
| **Keyboard-only testing**              | Verify all interactions work without mouse | Before release  |

---

## 8. Proposed Form Schema Design

### Form Definition Schema

This is the JSON structure stored in PostgreSQL as a JSONB column on a new `form_definitions` table.

```typescript
/**
 * Top-level form definition stored as JSONB in PostgreSQL.
 * Each SubmissionPeriod has one FormDefinition.
 */
interface FormDefinition {
  /** Schema version for migration support */
  version: 1;

  /** Form metadata */
  title: string;
  description?: string;

  /** Ordered list of form fields and sections */
  fields: FormField[];

  /** Form-level settings */
  settings: FormSettings;
}

interface FormSettings {
  /** Whether to show a progress indicator */
  showProgress: boolean;
  /** Submit button text */
  submitButtonText: string;
  /** Confirmation message after submission */
  confirmationMessage: string;
  /** Whether to require authentication before showing the form */
  requireAuth: boolean;
}

/**
 * A single field or section in the form.
 */
interface FormField {
  /** Unique identifier for this field (UUID) */
  id: string;
  /** Machine-readable key for data storage */
  key: string;
  /** Field type */
  type: FormFieldType;
  /** Display label */
  label: string;
  /** Help text shown below the field */
  description?: string;
  /** Placeholder text for input fields */
  placeholder?: string;
  /** Validation rules */
  validate: FieldValidation;
  /** Conditional display rules */
  conditional?: ConditionalRule;
  /** Type-specific properties */
  properties: FieldProperties;
}

type FormFieldType =
  | "text" // Single-line text input
  | "textarea" // Multi-line text area
  | "rich_text" // Rich text editor (for bios, cover letters)
  | "number" // Numeric input
  | "email" // Email input with validation
  | "url" // URL input with validation
  | "date" // Date picker
  | "select" // Single-select dropdown
  | "multi_select" // Multi-select (tags/checkboxes)
  | "radio" // Radio button group
  | "checkbox" // Single checkbox (boolean)
  | "checkbox_group" // Multiple checkboxes (multi-value)
  | "file_upload" // File upload (tus)
  | "section_header" // Visual section divider with heading
  | "info_text"; // Read-only informational text block

interface FieldValidation {
  /** Whether the field is required */
  required: boolean;
  /** Minimum length (text types) */
  minLength?: number;
  /** Maximum length (text types) */
  maxLength?: number;
  /** Minimum value (number type) */
  min?: number;
  /** Maximum value (number type) */
  max?: number;
  /** Regex pattern (text types) */
  pattern?: string;
  /** Custom error message for pattern validation */
  patternMessage?: string;
  /** Maximum files (file_upload type) */
  maxFiles?: number;
  /** Allowed MIME types (file_upload type) */
  allowedTypes?: string[];
  /** Maximum file size in bytes (file_upload type) */
  maxFileSize?: number;
}

interface ConditionalRule {
  /** What happens when the condition is met */
  effect: "SHOW" | "HIDE" | "ENABLE" | "DISABLE" | "REQUIRE";
  /** The condition to evaluate */
  condition: {
    operator: "AND" | "OR";
    rules: Array<{
      field: string; // key of the field to check
      comparator:
        | "eq"
        | "neq"
        | "gt"
        | "lt"
        | "gte"
        | "lte"
        | "contains"
        | "not_contains"
        | "starts_with"
        | "ends_with"
        | "is_empty"
        | "is_not_empty"
        | "in"
        | "not_in";
      value: string | number | boolean | string[];
    }>;
  };
}

/**
 * Type-specific properties. Each field type uses a subset.
 */
interface FieldProperties {
  /** Options for select, multi_select, radio, checkbox_group */
  options?: Array<{ label: string; value: string }>;
  /** Default value */
  defaultValue?: string | number | boolean | string[];
  /** Number of rows for textarea */
  rows?: number;
  /** Whether to allow multiple selections (for select) */
  multiple?: boolean;
  /** Heading level for section_header (2-4) */
  headingLevel?: 2 | 3 | 4;
  /** Rich text content for info_text */
  content?: string;
  /** Date constraints */
  minDate?: string; // ISO date
  maxDate?: string; // ISO date
}
```

### Example: Fiction Submission Form

```json
{
  "version": 1,
  "title": "Fiction Submission",
  "description": "Submit your short fiction for consideration in our next issue.",
  "settings": {
    "showProgress": true,
    "submitButtonText": "Submit for Review",
    "confirmationMessage": "Thank you for your submission. You will receive a confirmation email shortly.",
    "requireAuth": true
  },
  "fields": [
    {
      "id": "f1",
      "key": "title",
      "type": "text",
      "label": "Title of Work",
      "placeholder": "Enter the title of your story",
      "validate": { "required": true, "maxLength": 500 },
      "properties": {}
    },
    {
      "id": "f2",
      "key": "genre",
      "type": "select",
      "label": "Genre",
      "validate": { "required": true },
      "properties": {
        "options": [
          { "label": "Literary Fiction", "value": "literary_fiction" },
          { "label": "Science Fiction", "value": "science_fiction" },
          { "label": "Fantasy", "value": "fantasy" },
          { "label": "Horror", "value": "horror" },
          { "label": "Mystery", "value": "mystery" },
          { "label": "Other", "value": "other" }
        ]
      }
    },
    {
      "id": "f3",
      "key": "genre_other",
      "type": "text",
      "label": "Please specify genre",
      "validate": { "required": true, "maxLength": 100 },
      "conditional": {
        "effect": "SHOW",
        "condition": {
          "operator": "AND",
          "rules": [{ "field": "genre", "comparator": "eq", "value": "other" }]
        }
      },
      "properties": {}
    },
    {
      "id": "f4",
      "key": "word_count",
      "type": "number",
      "label": "Word Count",
      "validate": { "required": true, "min": 100, "max": 10000 },
      "properties": {}
    },
    {
      "id": "f5",
      "key": "simultaneous",
      "type": "radio",
      "label": "Is this a simultaneous submission?",
      "description": "Are you submitting this work to other publications at the same time?",
      "validate": { "required": true },
      "properties": {
        "options": [
          { "label": "Yes", "value": "yes" },
          { "label": "No", "value": "no" }
        ]
      }
    },
    {
      "id": "f6",
      "key": "section_manuscript",
      "type": "section_header",
      "label": "Manuscript",
      "description": "Upload your manuscript as a PDF or Word document.",
      "validate": { "required": false },
      "properties": { "headingLevel": 2 }
    },
    {
      "id": "f7",
      "key": "manuscript",
      "type": "file_upload",
      "label": "Manuscript File",
      "description": "PDF or Word document, max 50MB",
      "validate": {
        "required": true,
        "maxFiles": 1,
        "allowedTypes": [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ],
        "maxFileSize": 52428800
      },
      "properties": {}
    },
    {
      "id": "f8",
      "key": "cover_letter",
      "type": "rich_text",
      "label": "Cover Letter",
      "description": "Optional. Tell us about yourself and your work.",
      "validate": { "required": false, "maxLength": 10000 },
      "properties": { "rows": 6 }
    },
    {
      "id": "f9",
      "key": "bio",
      "type": "textarea",
      "label": "Author Bio",
      "description": "Brief third-person bio (100 words max).",
      "validate": { "required": true, "maxLength": 1000 },
      "properties": { "rows": 4 }
    },
    {
      "id": "f10",
      "key": "previously_published",
      "type": "checkbox",
      "label": "This work has been previously published",
      "validate": { "required": false },
      "properties": { "defaultValue": false }
    },
    {
      "id": "f11",
      "key": "publication_details",
      "type": "textarea",
      "label": "Publication Details",
      "description": "Where and when was this work previously published?",
      "validate": { "required": true, "maxLength": 2000 },
      "conditional": {
        "effect": "SHOW",
        "condition": {
          "operator": "AND",
          "rules": [
            {
              "field": "previously_published",
              "comparator": "eq",
              "value": true
            }
          ]
        }
      },
      "properties": { "rows": 3 }
    }
  ]
}
```

### Database Schema Changes

```prisma
// New table for form definitions
model FormDefinition {
  id               String   @id @default(uuid()) @db.Uuid
  organizationId   String   @map("organization_id") @db.Uuid
  name             String   // Internal name for editors
  slug             String   // URL-safe identifier
  definition       Json     // The FormDefinition JSON (JSONB)
  version          Int      @default(1) // Incrementing version for edit history
  isPublished      Boolean  @default(false) @map("is_published")
  publishedAt      DateTime? @map("published_at")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  submissionPeriods SubmissionPeriod[]

  @@unique([organizationId, slug])
  @@index([organizationId])
  @@map("form_definitions")
}

// Add to SubmissionPeriod
model SubmissionPeriod {
  // ... existing fields ...
  formDefinitionId String? @map("form_definition_id") @db.Uuid
  formDefinition   FormDefinition? @relation(fields: [formDefinitionId], references: [id])
}

// New table for structured form responses
model FormResponse {
  id           String   @id @default(uuid()) @db.Uuid
  submissionId String   @unique @map("submission_id") @db.Uuid
  formVersion  Int      @map("form_version") // Version of the form at submission time
  data         Json     // The actual form response data (JSONB)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@map("form_responses")
}
```

### Form Response Data Structure

When a submitter fills out the form, the response data is stored as a flat key-value object:

```json
{
  "title": "The Last Garden",
  "genre": "literary_fiction",
  "word_count": 3500,
  "simultaneous": "no",
  "manuscript": [
    {
      "fileId": "abc-123",
      "filename": "last_garden.pdf",
      "size": 245678,
      "scanStatus": "CLEAN"
    }
  ],
  "cover_letter": "<p>Dear Editors,</p><p>I am submitting...</p>",
  "bio": "Jane Doe is a writer from Portland, Oregon...",
  "previously_published": false
}
```

Note that `genre_other` and `publication_details` are absent because their conditional rules evaluated to `false`. Only visible (and applicable) fields are included in the response.

### Zod Validation Schema Generation

At runtime, the form definition JSON is used to generate a Zod schema for server-side validation:

```typescript
function generateValidationSchema(definition: FormDefinition): z.ZodSchema {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of definition.fields) {
    if (field.type === "section_header" || field.type === "info_text") continue;

    let schema: z.ZodTypeAny;

    switch (field.type) {
      case "text":
      case "textarea":
      case "rich_text":
      case "email":
      case "url":
        schema = z.string();
        if (field.validate.maxLength)
          schema = (schema as z.ZodString).max(field.validate.maxLength);
        if (field.validate.minLength)
          schema = (schema as z.ZodString).min(field.validate.minLength);
        if (field.type === "email") schema = (schema as z.ZodString).email();
        if (field.type === "url") schema = (schema as z.ZodString).url();
        break;
      case "number":
        schema = z.number();
        if (field.validate.min !== undefined)
          schema = (schema as z.ZodNumber).min(field.validate.min);
        if (field.validate.max !== undefined)
          schema = (schema as z.ZodNumber).max(field.validate.max);
        break;
      case "checkbox":
        schema = z.boolean();
        break;
      case "select":
      case "radio":
        const values = field.properties.options?.map((o) => o.value) ?? [];
        schema = z.enum(values as [string, ...string[]]);
        break;
      case "multi_select":
      case "checkbox_group":
        schema = z.array(z.string());
        break;
      case "file_upload":
        schema = z.array(
          z.object({
            fileId: z.string().uuid(),
            filename: z.string(),
            size: z.number(),
            scanStatus: z.enum(["CLEAN"]), // Only CLEAN files allowed on submit
          }),
        );
        if (field.validate.maxFiles)
          schema = (schema as z.ZodArray<z.ZodAny>).max(
            field.validate.maxFiles,
          );
        break;
      case "date":
        schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
        break;
      default:
        schema = z.unknown();
    }

    // Make optional if not required (considering conditional fields)
    if (!field.validate.required) {
      schema = schema.optional();
    }

    shape[field.key] = schema;
  }

  return z.object(shape);
}
```

---

## 9. Architecture Recommendation

### Summary of Decisions

| Decision                  | Choice                                                  | Rationale                                                               |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Form schema format**    | Custom (Form.io-inspired components array)              | Simple, flat, optimized for literary submissions. No over-engineering.  |
| **Schema storage**        | PostgreSQL JSONB column                                 | Consistent with existing stack. Queryable with GIN indexes.             |
| **Form builder UI**       | Custom, built with dnd-kit + shadcn/ui                  | Full control, no license dependencies, consistent with existing UI.     |
| **DnD library**           | dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`)         | Best accessibility, hooks-based, proven for form builders.              |
| **Conditional logic**     | Custom rule engine (JSON Logic-inspired)                | Simple, performant, serializable, no external dependency.               |
| **Embeddable forms**      | iframe (Phase 1) + Web Component wrapper (Phase 2)      | Complete isolation, simple auth, works everywhere.                      |
| **File uploads in forms** | Existing tus pipeline, file references in form response | No new infrastructure needed.                                           |
| **Form rendering**        | Custom React components using shadcn/ui primitives      | Consistent with existing app. Accessible by default (Radix primitives). |
| **Validation**            | Zod schemas generated from form definition at runtime   | Consistent with existing stack. Server-side + client-side.              |

### New Packages to Add

```json
{
  "@dnd-kit/core": "^6.3",
  "@dnd-kit/sortable": "^8.0",
  "@dnd-kit/utilities": "^3.2"
}
```

No other new dependencies required. The form builder uses existing shadcn/ui components, Zod, react-hook-form, and tus-js-client.

### Implementation Phases

#### Phase 1: Core Form Builder (4-6 weeks)

1. **Database**: Add `FormDefinition` and `FormResponse` tables with migration + RLS policies.
2. **Schema**: Create Zod schemas in `packages/types/src/form.ts` for form definition validation.
3. **API**: Add `forms` tRPC router (CRUD for form definitions, get published form).
4. **Builder UI**: Field palette, drag-and-drop canvas, field properties panel.
5. **Renderer**: Form rendering component that takes a `FormDefinition` and produces a working form.
6. **Field types**: text, textarea, number, select, radio, checkbox, file_upload, section_header, info_text.

#### Phase 2: Advanced Features (2-3 weeks)

7. **Conditional logic**: Rule engine + rule builder UI in field properties panel.
8. **Additional field types**: email, url, date, multi_select, checkbox_group, rich_text.
9. **Form preview**: Live preview in builder UI.
10. **Form versioning**: Track versions so historical submissions reference the correct form version.

#### Phase 3: Embeddable Forms (2-3 weeks)

11. **Public form page**: `/forms/:orgSlug/:formSlug` route that renders the form without dashboard chrome.
12. **iframe embed**: Auto-resize script, theming via URL params.
13. **Authentication flow**: Login/register within embedded form context.
14. **Form analytics**: Submission counts, completion rates, abandonment tracking.

#### Phase 4: Polish (1-2 weeks)

15. **Form templates**: Pre-built templates for Fiction, Poetry, Nonfiction, Visual Art.
16. **Duplicate form**: Copy an existing form definition.
17. **Export/import**: JSON export/import for sharing form definitions between organizations.
18. **Keyboard shortcut cheat sheet**: For the builder UI.

### File Structure

```
packages/types/src/
  form.ts                          # FormDefinition, FormField, FormResponse Zod schemas

apps/api/src/trpc/routers/
  forms.router.ts                  # CRUD for form definitions

apps/web/src/
  components/form-builder/
    field-palette.tsx              # Draggable field type list
    form-canvas.tsx                # Droppable, sortable field list
    field-properties.tsx           # Selected field configuration panel
    form-builder.tsx               # Main builder layout (3-column)
    form-preview.tsx               # Live form preview
    conditional-rule-builder.tsx   # Visual rule builder
    fields/                        # Field type components for builder
      text-field-builder.tsx
      select-field-builder.tsx
      file-upload-field-builder.tsx
      ... (one per field type)
  components/form-renderer/
    form-renderer.tsx              # Renders a FormDefinition as a working form
    fields/                        # Field type components for rendering
      text-field.tsx
      select-field.tsx
      file-upload-field.tsx
      ... (one per field type)
    conditional-evaluator.ts       # Rule evaluation engine
    schema-generator.ts            # Generates Zod schema from FormDefinition
  hooks/
    use-form-builder.ts            # Form builder state management
    use-conditional-fields.ts      # Conditional logic evaluation hook
```

### Key Architectural Principles

1. **Builder and Renderer are separate component trees.** The builder shows field configuration UI. The renderer shows the actual form. They share the `FormDefinition` type but not components.

2. **The form definition is the single source of truth.** Both builder and renderer derive their behavior from the JSON definition. No side-channel state.

3. **Server-side validation mirrors client-side.** The Zod schema generated from the form definition is used both on the client (for immediate feedback) and on the server (for security). Never trust client-side validation alone.

4. **Form definitions are versioned.** When an editor modifies a published form, the version increments. Historical submissions reference the version they were submitted against, so the review UI can show the correct form layout.

5. **File uploads are decoupled from form submission.** Files are uploaded via tus as soon as the user selects them. The form response data contains file references, not file data.

6. **RLS applies to form definitions.** The `FormDefinition` table gets RLS policies scoped to `organization_id`, consistent with all other tenant-scoped tables.

---

## Sources

### JSON Schema and Form Definition

- [JSON Schema Specification (2020-12)](https://json-schema.org/draft/2020-12)
- [React JSON Schema Form (RJSF)](https://github.com/rjsf-team/react-jsonschema-form)
- [JSON Forms by EclipseSource](https://github.com/eclipsesource/jsonforms)
- [JSON Forms Architecture](https://jsonforms.io/docs/architecture/)
- [Form.io JSON Schema](https://github.com/formio/formio.js/wiki/Form-JSON-Schema)
- [Form.io Components JSON Schema](https://github.com/formio/formio.js/wiki/Components-JSON-Schema)
- [Form.io Logic & Conditions](https://help.form.io/userguide/forms/form-building/logic-and-conditions)

### Open-Source Form Builders

- [Formbricks](https://github.com/formbricks/formbricks)
- [SurveyJS](https://surveyjs.io/) — [Architecture](https://surveyjs.io/documentation/surveyjs-architecture) | [Pricing](https://surveyjs.io/pricing) | [Licensing](https://surveyjs.io/licensing)
- [Form.io Open Source](https://form.io/open-source/)
- [Typebot](https://github.com/baptisteArno/typebot.io)
- [HeyForm](https://github.com/heyform/heyform)
- [Tripetto SDK](https://tripetto.com/sdk/)
- [Top Open-Source Form Builders 2025 (SurveyJS)](https://surveyjs.io/stay-updated/blog/top-5-open-source-form-builders-in-2025)
- [Top 6 Open Source Form Builders for 2026 (Budibase)](https://budibase.com/blog/open-source-form-builder/)
- [Submittable Literary Journal Setup](https://submittable.help/en/articles/2580177-setting-up-your-literary-journal-with-submittable)
- [Submittable Build a Form](https://www.submittable.com/lessons/build-a-form/)
- [Submission Management Systems for Lit Mags](https://litmaglab.substack.com/p/submission-management-systems-for-lit-mags-and-presses)

### Drag-and-Drop Libraries

- [dnd-kit](https://dndkit.com/) — [Documentation](https://docs.dndkit.com) | [Accessibility](https://docs.dndkit.com/guides/accessibility) | [Sortable](https://docs.dndkit.com/presets/sortable) | [Form Builder Discussion](https://github.com/clauderic/dnd-kit/discussions/639)
- [dnd-kit Maintenance Discussion](https://github.com/clauderic/dnd-kit/issues/1194)
- [Pragmatic Drag and Drop (Atlassian)](https://atlassian.design/components/pragmatic-drag-and-drop/) — [Accessibility Guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines/) | [React Accessibility Package](https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/react-accessibility/)
- [Top 5 DnD Libraries for React 2026 (Puck)](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd)

### Conditional Logic

- [JSON Logic](https://jsonlogic.com/) — [Operations](https://jsonlogic.com/operations.html)
- [JSON Logic Engine](https://github.com/json-logic/json-logic-engine)
- [json-logic-js](https://github.com/jwadhams/json-logic-js)

### Embeddable Widgets

- [Building Embeddable React Widgets (MakerKit)](https://makerkit.dev/blog/tutorials/embeddable-widgets-react)
- [Embeddable Web Applications with Shadow DOM (Viget)](https://www.viget.com/articles/embedable-web-applications-with-shadow-dom)
- [Web Components: Working With Shadow DOM (Smashing Magazine)](https://www.smashingmagazine.com/2025/07/web-components-working-with-shadow-dom/)
- [iFrames vs Web Components (Luzmo)](https://www.luzmo.com/blog/iframe-vs-web-component)
- [Using Shadow DOM (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)

### Accessibility

- [WCAG 2.1 AA Compliance Checklist (WebAbility)](https://www.webability.io/blog/wcag-2-1-aa-the-standard-for-accessible-web-design)
- [Understanding Keyboard Accessibility (W3C WAI)](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [WCAG Accessibility Checklist (BrowserStack)](https://www.browserstack.com/guide/wcag-compliance-checklist)

### File Uploads

- [tus Protocol](https://tus.io/)
- [tus-js-client](https://github.com/tus/tus-js-client)
- [use-tus React Hooks](https://github.com/kqito/use-tus)

### Tally / Typeform

- [Tally Developer Docs — Creating a Form](https://developers.tally.so/documentation/creating-a-form)
- [Typeform Data Portability](https://help.typeform.com/hc/en-us/articles/360029616371-Data-portability)
