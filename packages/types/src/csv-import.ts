import { z } from "zod";
import type { CSRStatus } from "./csr";

// --- Duplicate check ---

export const duplicateCheckInputSchema = z.object({
  candidates: z
    .array(
      z.object({
        journalName: z.string().min(1).max(500),
        sentAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(5000),
});

export type DuplicateCheckInput = z.infer<typeof duplicateCheckInputSchema>;

export const duplicateCheckResultSchema = z.array(
  z.object({
    candidateIndex: z.number().int(),
    existingId: z.string().uuid(),
    existingJournalName: z.string(),
    existingSentAt: z.string().datetime().nullable(),
  }),
);

export type DuplicateCheckResult = z.infer<typeof duplicateCheckResultSchema>;

// --- Preset enum ---

export const csvImportPresetSchema = z.enum([
  "submittable",
  "chillsubs",
  "generic",
]);
export type CsvImportPreset = z.infer<typeof csvImportPresetSchema>;

// --- Column mapping ---

export type CsrTargetField =
  | "journalName"
  | "status"
  | "sentAt"
  | "respondedAt"
  | "method"
  | "notes"
  | "skip";

export interface ColumnMapping {
  csvHeader: string;
  target: CsrTargetField;
}

// --- Status mapping ---

export interface StatusMapping {
  csvValue: string;
  csrStatus: CSRStatus;
}

// --- Preset definition ---

export interface ImportPresetDefinition {
  id: CsvImportPreset;
  label: string;
  description: string;
  importedFrom: string;
  columnMappings: Array<{ pattern: RegExp; target: CsrTargetField }>;
  statusMappings: StatusMapping[];
  dateFormats: string[];
}

// --- Validation results ---

export interface CsvRowValidation {
  rowIndex: number;
  errors: string[];
  warnings: string[];
}

export interface CsvImportValidation {
  totalRows: number;
  validRows: number;
  errorRows: CsvRowValidation[];
  duplicateWarnings: Array<{
    rowIndex: number;
    existingJournalName: string;
    existingSentAt: string | null;
  }>;
}
