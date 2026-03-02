# CSR Format Specification (v1.0)

> **Canonical source:** `packages/types/src/csr.ts`
> **Status:** Stable (v1.0)

The Colophony Submission Record (CSR) is a JSON-based data portability format for writers. It enables export of all submission-related data from a Colophony instance and import of external submission records from CSV or JSON sources.

---

## Export Envelope

The top-level export structure (`csrExportEnvelopeSchema`):

| Field                  | Type              | Description                                           |
| ---------------------- | ----------------- | ----------------------------------------------------- |
| `version`              | `"1.0"` (literal) | Format version                                        |
| `exportedAt`           | ISO 8601 datetime | When the export was generated                         |
| `identity`             | object            | Exporting user identity                               |
| `identity.userId`      | UUID              | Colophony user ID                                     |
| `identity.email`       | string (email)    | User email                                            |
| `identity.displayName` | string \| null    | Display name                                          |
| `nativeSubmissions`    | array             | Colophony-origin submissions (see Native Submissions) |
| `externalSubmissions`  | array             | Manually-tracked external submissions                 |
| `correspondence`       | array             | Editor-writer correspondence records                  |
| `writerProfiles`       | array             | External platform profile links                       |
| `manuscripts`          | array             | Lightweight manuscript references                     |

---

## Status Model

CSR defines 10 harmonized statuses that map across submission systems:

| CSR Status    | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `draft`       | Not yet submitted                                              |
| `sent`        | Submitted / sent to journal                                    |
| `in_review`   | Under active editorial review                                  |
| `hold`        | Held for further consideration (shortlisted)                   |
| `accepted`    | Accepted for publication                                       |
| `rejected`    | Declined by the journal                                        |
| `withdrawn`   | Withdrawn by the writer                                        |
| `no_response` | No response received (external submissions only)               |
| `revise`      | Revise and resubmit requested                                  |
| `unknown`     | Status could not be determined (fallback for unmapped imports) |

### Hopper-to-CSR Status Mapping

Source: `packages/types/src/status-mapping.ts`

| Hopper Status         | CSR Status  |
| --------------------- | ----------- |
| `DRAFT`               | `draft`     |
| `SUBMITTED`           | `sent`      |
| `UNDER_REVIEW`        | `in_review` |
| `HOLD`                | `hold`      |
| `ACCEPTED`            | `accepted`  |
| `REJECTED`            | `rejected`  |
| `WITHDRAWN`           | `withdrawn` |
| `REVISE_AND_RESUBMIT` | `revise`    |

CSR statuses `no_response` and `unknown` have no Hopper equivalent. The reverse mapping (`csrToHopperStatus`) returns `null` for these.

---

## Genre Model

Genres live on manuscripts, not submissions. The genre schema (`genreSchema`):

| Field     | Type                    | Description                                           |
| --------- | ----------------------- | ----------------------------------------------------- |
| `primary` | enum (10 values)        | Primary genre classification                          |
| `sub`     | string \| null          | Freetext subgenre (e.g., "flash", "lyric essay")      |
| `hybrid`  | array of primary genres | Additional primary genres for hybrid/cross-genre work |

**Primary genres:** `poetry`, `fiction`, `creative_nonfiction`, `nonfiction`, `drama`, `translation`, `visual_art`, `comics`, `audio`, `other`

---

## Journal Reference

The `journalRefSchema` supports graceful degradation from fully-federated to freetext-only references:

| Field             | Type              | Description                                      |
| ----------------- | ----------------- | ------------------------------------------------ |
| `id`              | UUID (optional)   | Internal journal ID                              |
| `name`            | string (required) | Journal display name (always present)            |
| `colophonyDomain` | string \| null    | Federated Colophony instance domain              |
| `colophonyOrgId`  | UUID \| null      | Org ID on the federated instance                 |
| `externalUrl`     | URL \| null       | Journal website URL                              |
| `directoryIds`    | Record \| null    | Third-party directory IDs (e.g., Duotrope, CLMP) |

**Degradation:** Federated (has `colophonyDomain` + `colophonyOrgId`) > Directory-linked (has `directoryIds`) > Freetext (name only).

---

## Field Reference

### Native Submissions

Colophony-origin submissions exported via `csrNativeSubmissionSchema`:

| Field                | Type             | Description                        |
| -------------------- | ---------------- | ---------------------------------- |
| `originSubmissionId` | UUID             | Original Colophony submission ID   |
| `title`              | string \| null   | Submission title                   |
| `genre`              | Genre \| null    | Structured genre (see Genre Model) |
| `coverLetter`        | string \| null   | Cover letter text                  |
| `status`             | CSRStatus        | Harmonized status                  |
| `formData`           | Record \| null   | Custom form field data             |
| `submittedAt`        | datetime \| null | When submitted                     |
| `decidedAt`          | datetime \| null | When decision was made             |
| `publicationName`    | string \| null   | Publication/journal name           |
| `periodName`         | string \| null   | Reading period name                |
| `statusHistory`      | array            | Status change audit trail          |

### External Submissions

Manually-tracked submissions (`externalSubmissionSchema`):

| Field                | Type             | Description                             |
| -------------------- | ---------------- | --------------------------------------- |
| `id`                 | UUID             | Record ID                               |
| `manuscriptId`       | UUID \| null     | Linked manuscript                       |
| `journalDirectoryId` | UUID \| null     | Linked journal directory entry          |
| `journalName`        | string           | Journal name (always present)           |
| `status`             | CSRStatus        | Harmonized status                       |
| `sentAt`             | datetime \| null | When sent to journal                    |
| `respondedAt`        | datetime \| null | When response received                  |
| `method`             | string \| null   | Submission method (e.g., "Submittable") |
| `notes`              | string \| null   | Writer notes                            |
| `importedFrom`       | string \| null   | Import source identifier                |
| `createdAt`          | datetime         | Record creation time                    |
| `updatedAt`          | datetime         | Last update time                        |

### Correspondence

Editor-writer correspondence (`correspondenceSchema`):

| Field                  | Type           | Description                                    |
| ---------------------- | -------------- | ---------------------------------------------- |
| `id`                   | UUID           | Record ID                                      |
| `submissionId`         | UUID \| null   | Linked native submission (XOR)                 |
| `externalSubmissionId` | UUID \| null   | Linked external submission (XOR)               |
| `direction`            | enum           | `inbound` or `outbound`                        |
| `channel`              | enum           | `email`, `portal`, `in_app`, `other`           |
| `sentAt`               | datetime       | When the message was sent                      |
| `subject`              | string \| null | Message subject line                           |
| `body`                 | string         | Message body (min 1 char)                      |
| `senderName`           | string \| null | Sender display name                            |
| `senderEmail`          | email \| null  | Sender email address                           |
| `isPersonalized`       | boolean        | Whether this was a personal (non-form) message |
| `source`               | enum           | `colophony` (auto-captured) or `manual`        |
| `capturedAt`           | datetime       | When the record was created                    |

### Writer Profiles

External platform profile links (`writerProfileSchema`):

| Field        | Type           | Description                         |
| ------------ | -------------- | ----------------------------------- |
| `id`         | UUID           | Record ID                           |
| `platform`   | string         | Platform name (e.g., "Submittable") |
| `externalId` | string \| null | External platform user ID           |
| `profileUrl` | URL \| null    | Profile page URL                    |

### Manuscripts

Lightweight manuscript summaries (`csrManuscriptSummarySchema`):

| Field       | Type           | Description      |
| ----------- | -------------- | ---------------- |
| `id`        | UUID           | Manuscript ID    |
| `title`     | string \| null | Manuscript title |
| `genre`     | Genre \| null  | Structured genre |
| `createdAt` | datetime       | Creation time    |

---

## Import Format

### JSON Import

The `csrImportInputSchema` accepts:

| Field            | Type   | Description                                          |
| ---------------- | ------ | ---------------------------------------------------- |
| `submissions`    | array  | External submissions to create (1-5000)              |
| `correspondence` | array  | Correspondence records to attach (default: [])       |
| `importedFrom`   | string | Source identifier (default: `"csr_import"`, max 100) |

**Correspondence linkage:** Each correspondence record has an `externalSubmissionIndex` (0-based integer) that references the position in the `submissions` array. After submissions are created, correspondence records are linked to the resulting submission IDs.

### Import Result

| Field                   | Type | Description                              |
| ----------------------- | ---- | ---------------------------------------- |
| `submissionsCreated`    | int  | Number of submissions created            |
| `correspondenceCreated` | int  | Number of correspondence records created |

---

## CSV Import Presets

CSV import is handled client-side with preset column/status mappings, then submitted as a JSON import payload.

### Submittable

- **ID:** `submittable`
- **Column patterns:** Title → journalName, Status, Submitted → sentAt, Response → respondedAt
- **Status mappings:** "In-Progress" → `in_review`, "Accepted" → `accepted`, "Declined" → `rejected`, "Withdrawn" → `withdrawn`, "Draft" → `draft`
- **Date formats:** `MM/dd/yyyy`, `yyyy-MM-dd`

### Chill Subs

- **ID:** `chillsubs`
- **Column patterns:** Market/Publication → journalName, Status, Date Sent → sentAt, Date Response → respondedAt
- **Status mappings:** "Sent" → `sent`, "Accepted" → `accepted`, "Rejected" → `rejected`, "Withdrawn" → `withdrawn`, "No Response" → `no_response`
- **Date formats:** `yyyy-MM-dd`, `MM/dd/yyyy`

### Generic

- **ID:** `generic`
- **Column patterns:** Journal/Publication/Magazine → journalName, Status, Sent/Submitted → sentAt, Response/Replied → respondedAt
- **Status mappings:** None (user maps manually)
- **Date formats:** `yyyy-MM-dd`, `MM/dd/yyyy`, `dd/MM/yyyy`

Preset definitions: `apps/web/src/lib/csv-import.ts`
Type definitions: `packages/types/src/csv-import.ts`

---

## Examples

### Export Envelope

```json
{
  "version": "1.0",
  "exportedAt": "2026-03-01T12:00:00.000Z",
  "identity": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "writer@example.com",
    "displayName": "Jane Author"
  },
  "nativeSubmissions": [
    {
      "originSubmissionId": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Autumn Leaves",
      "genre": { "primary": "poetry", "sub": "lyric", "hybrid": [] },
      "coverLetter": "Dear Editors, please consider...",
      "status": "in_review",
      "formData": null,
      "submittedAt": "2026-01-15T10:00:00.000Z",
      "decidedAt": null,
      "publicationName": "The Example Review",
      "periodName": "Spring 2026",
      "statusHistory": [
        {
          "from": null,
          "to": "sent",
          "changedAt": "2026-01-15T10:00:00.000Z",
          "comment": null
        },
        {
          "from": "sent",
          "to": "in_review",
          "changedAt": "2026-01-20T08:30:00.000Z",
          "comment": null
        }
      ]
    }
  ],
  "externalSubmissions": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "manuscriptId": null,
      "journalDirectoryId": null,
      "journalName": "The Paris Review",
      "status": "rejected",
      "sentAt": "2025-11-01T00:00:00.000Z",
      "respondedAt": "2026-02-15T00:00:00.000Z",
      "method": "Submittable",
      "notes": "Form rejection",
      "importedFrom": "submittable",
      "createdAt": "2026-02-20T09:00:00.000Z",
      "updatedAt": "2026-02-20T09:00:00.000Z"
    }
  ],
  "correspondence": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "submissionId": null,
      "externalSubmissionId": "770e8400-e29b-41d4-a716-446655440002",
      "direction": "inbound",
      "channel": "email",
      "sentAt": "2026-02-15T14:00:00.000Z",
      "subject": "Re: Submission",
      "body": "Thank you for submitting. Unfortunately...",
      "senderName": "Editor",
      "senderEmail": "editor@parisreview.com",
      "isPersonalized": false,
      "source": "manual",
      "capturedAt": "2026-02-20T09:05:00.000Z"
    }
  ],
  "writerProfiles": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "platform": "Submittable",
      "externalId": "sub_12345",
      "profileUrl": "https://submittable.com/profile/12345"
    }
  ],
  "manuscripts": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "title": "Autumn Leaves",
      "genre": { "primary": "poetry", "sub": "lyric", "hybrid": [] },
      "createdAt": "2025-10-01T00:00:00.000Z"
    }
  ]
}
```

### Import Payload

```json
{
  "submissions": [
    {
      "journalName": "The Paris Review",
      "status": "rejected",
      "sentAt": "2025-11-01T00:00:00.000Z",
      "respondedAt": "2026-02-15T00:00:00.000Z",
      "method": "Submittable",
      "notes": "Form rejection",
      "importedFrom": "submittable"
    },
    {
      "journalName": "Ploughshares",
      "status": "sent",
      "sentAt": "2026-01-10T00:00:00.000Z"
    }
  ],
  "correspondence": [
    {
      "externalSubmissionIndex": 0,
      "direction": "inbound",
      "channel": "email",
      "sentAt": "2026-02-15T14:00:00.000Z",
      "subject": "Re: Submission",
      "body": "Thank you for submitting. Unfortunately..."
    }
  ],
  "importedFrom": "submittable"
}
```

---

## Extension Points

- **Hybrid genre:** The `hybrid` array allows cross-genre works without losing the primary classification
- **Unknown status:** The `unknown` fallback ensures imports never fail due to unmappable statuses
- **`importedFrom` provenance:** Tracks the origin system for each imported record, enabling future de-duplication
- **Directory linking:** `journalDirectoryId` links to the shared journal directory; batch matching during CSV import auto-links known journals
- **Source field:** Correspondence `source` distinguishes auto-captured (`colophony`) from manually logged (`manual`) records
