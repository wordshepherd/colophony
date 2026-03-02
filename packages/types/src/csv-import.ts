import { z } from "zod";
import type { CSRStatus } from "./csr";

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
