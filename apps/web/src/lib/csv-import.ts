import Papa from "papaparse";
import { parse as parseDateFn, isValid } from "date-fns";
import type { CSRStatus } from "@colophony/types";
import type {
  CsvImportPreset,
  CsrTargetField,
  ColumnMapping,
  StatusMapping,
  ImportPresetDefinition,
  CsvImportValidation,
  CsvRowValidation,
} from "@colophony/types";
import type { CSRImportInput } from "@colophony/types";

// ---------------------------------------------------------------------------
// CSR status options (shared UI constant)
// ---------------------------------------------------------------------------

export const CSR_STATUS_OPTIONS: Array<{ value: CSRStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_review", label: "In Review" },
  { value: "hold", label: "Hold" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "no_response", label: "No Response" },
  { value: "revise", label: "Revise" },
  { value: "unknown", label: "Unknown" },
];

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

const SUBMITTABLE_PRESET: ImportPresetDefinition = {
  id: "submittable",
  label: "Submittable",
  description: "Import from Submittable CSV export",
  importedFrom: "submittable",
  columnMappings: [
    { pattern: /publication|category/i, target: "journalName" },
    { pattern: /^status$/i, target: "status" },
    { pattern: /date\s*submitted/i, target: "sentAt" },
    { pattern: /last\s*activity|date\s*respond/i, target: "respondedAt" },
    { pattern: /method/i, target: "method" },
    { pattern: /notes/i, target: "notes" },
  ],
  statusMappings: [
    { csvValue: "New", csrStatus: "sent" },
    { csvValue: "In-Progress", csrStatus: "in_review" },
    { csvValue: "Accepted", csrStatus: "accepted" },
    { csvValue: "Declined", csrStatus: "rejected" },
    { csvValue: "Withdrawn", csrStatus: "withdrawn" },
  ],
  dateFormats: ["MM/dd/yyyy hh:mm a", "MM/dd/yyyy", "yyyy-MM-dd"],
};

const CHILLSUBS_PRESET: ImportPresetDefinition = {
  id: "chillsubs",
  label: "Chill Subs",
  description: "Import from Chill Subs CSV export",
  importedFrom: "chillsubs",
  columnMappings: [
    { pattern: /^journal$/i, target: "journalName" },
    { pattern: /^status$/i, target: "status" },
    { pattern: /date\s*sent/i, target: "sentAt" },
    { pattern: /date\s*respon/i, target: "respondedAt" },
    { pattern: /notes/i, target: "notes" },
  ],
  statusMappings: [
    { csvValue: "Pending", csrStatus: "sent" },
    { csvValue: "Accepted", csrStatus: "accepted" },
    { csvValue: "Rejected", csrStatus: "rejected" },
    { csvValue: "Withdrawn", csrStatus: "withdrawn" },
    { csvValue: "No Response", csrStatus: "no_response" },
  ],
  dateFormats: ["yyyy-MM-dd", "MMM dd, yyyy", "MM/dd/yyyy"],
};

const GENERIC_PRESET: ImportPresetDefinition = {
  id: "generic",
  label: "Generic CSV",
  description: "Import any CSV with manual column mapping",
  importedFrom: "csv_import",
  columnMappings: [],
  statusMappings: [],
  dateFormats: ["yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "MMM dd, yyyy"],
};

export const IMPORT_PRESETS: Record<CsvImportPreset, ImportPresetDefinition> = {
  submittable: SUBMITTABLE_PRESET,
  chillsubs: CHILLSUBS_PRESET,
  generic: GENERIC_PRESET,
};

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Strip UTF-8 BOM from first header
        return header.replace(/^\uFEFF/, "").trim();
      },
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const rows = (results.data as Record<string, string>[]).filter(
          (row) => {
            // Filter rows where all values are empty
            return Object.values(row).some((v) => v && v.trim() !== "");
          },
        );
        resolve({ headers, rows });
      },
      error: (err: Error) => reject(err),
    });
  });
}

// ---------------------------------------------------------------------------
// Column auto-mapping
// ---------------------------------------------------------------------------

export function autoMapColumns(
  headers: string[],
  preset: ImportPresetDefinition,
): ColumnMapping[] {
  return headers.map((csvHeader) => {
    const match = preset.columnMappings.find((m) => m.pattern.test(csvHeader));
    return {
      csvHeader,
      target: match ? match.target : "skip",
    };
  });
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

export function tryParseDate(value: string, formats: string[]): string | null {
  if (!value || !value.trim()) return null;

  const trimmed = value.trim();

  // Try ISO 8601 first
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return isoDate.toISOString();
  }

  // Try each format
  for (const fmt of formats) {
    const parsed = parseDateFn(trimmed, fmt, new Date());
    if (isValid(parsed)) {
      return parsed.toISOString();
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

export function mapStatus(
  rawStatus: string,
  mappings: StatusMapping[],
): CSRStatus {
  const normalized = rawStatus.trim().toLowerCase();
  const match = mappings.find(
    (m) => m.csvValue.trim().toLowerCase() === normalized,
  );
  return match ? match.csrStatus : "unknown";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateMappedRows(
  rows: Record<string, string>[],
  columnMappings: ColumnMapping[],
  statusMappings: StatusMapping[],
  dateFormats: string[],
): CsvImportValidation {
  const journalCol = columnMappings.find((m) => m.target === "journalName");
  const sentAtCol = columnMappings.find((m) => m.target === "sentAt");
  const respondedAtCol = columnMappings.find((m) => m.target === "respondedAt");
  const statusCol = columnMappings.find((m) => m.target === "status");

  const errorRows: CsvRowValidation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required: journalName
    if (journalCol) {
      const val = row[journalCol.csvHeader]?.trim();
      if (!val) {
        errors.push("Journal name is required");
      }
    }

    // Date warnings
    if (sentAtCol) {
      const val = row[sentAtCol.csvHeader]?.trim();
      if (val && !tryParseDate(val, dateFormats)) {
        warnings.push(`Could not parse sent date: "${val}"`);
      }
    }
    if (respondedAtCol) {
      const val = row[respondedAtCol.csvHeader]?.trim();
      if (val && !tryParseDate(val, dateFormats)) {
        warnings.push(`Could not parse response date: "${val}"`);
      }
    }

    // Status warning
    if (statusCol) {
      const val = row[statusCol.csvHeader]?.trim();
      if (val && mapStatus(val, statusMappings) === "unknown") {
        warnings.push(`Unmapped status: "${val}"`);
      }
    }

    if (errors.length > 0 || warnings.length > 0) {
      errorRows.push({ rowIndex: i, errors, warnings });
    }
  }

  const rowsWithErrors = errorRows.filter((r) => r.errors.length > 0);

  return {
    totalRows: rows.length,
    validRows: rows.length - rowsWithErrors.length,
    errorRows,
    duplicateWarnings: [],
  };
}

// ---------------------------------------------------------------------------
// Transform to CSR import input
// ---------------------------------------------------------------------------

interface TransformOptions {
  importedFrom: string;
  journalDirectoryMap?: Map<string, string>; // normalizedName → id
}

export function transformToCsrImport(
  rows: Record<string, string>[],
  columnMappings: ColumnMapping[],
  statusMappings: StatusMapping[],
  dateFormats: string[],
  options: TransformOptions,
): CSRImportInput {
  const fieldMap = new Map<CsrTargetField, string>();
  for (const m of columnMappings) {
    if (m.target !== "skip") {
      fieldMap.set(m.target, m.csvHeader);
    }
  }

  const submissions = rows
    .map((row) => {
      const journalHeader = fieldMap.get("journalName");
      const journalName = journalHeader
        ? row[journalHeader]?.trim()
        : undefined;
      if (!journalName) return null;

      const statusHeader = fieldMap.get("status");
      const rawStatus = statusHeader ? row[statusHeader]?.trim() : undefined;
      const status = rawStatus ? mapStatus(rawStatus, statusMappings) : "sent";

      const sentAtHeader = fieldMap.get("sentAt");
      const rawSentAt = sentAtHeader ? row[sentAtHeader]?.trim() : undefined;
      const sentAt = rawSentAt
        ? tryParseDate(rawSentAt, dateFormats)
        : undefined;

      const respondedAtHeader = fieldMap.get("respondedAt");
      const rawRespondedAt = respondedAtHeader
        ? row[respondedAtHeader]?.trim()
        : undefined;
      const respondedAt = rawRespondedAt
        ? tryParseDate(rawRespondedAt, dateFormats)
        : undefined;

      const methodHeader = fieldMap.get("method");
      const method = methodHeader
        ? row[methodHeader]?.trim() || undefined
        : undefined;

      const notesHeader = fieldMap.get("notes");
      const notes = notesHeader
        ? row[notesHeader]?.trim() || undefined
        : undefined;

      // Journal directory matching
      let journalDirectoryId: string | undefined;
      if (options.journalDirectoryMap) {
        const normalized = journalName.toLowerCase().trim();
        journalDirectoryId = options.journalDirectoryMap.get(normalized);
      }

      return {
        journalName,
        journalDirectoryId,
        status,
        sentAt: sentAt ?? undefined,
        respondedAt: respondedAt ?? undefined,
        method,
        notes,
        importedFrom: options.importedFrom,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    submissions,
    correspondence: [],
    importedFrom: options.importedFrom,
  };
}
