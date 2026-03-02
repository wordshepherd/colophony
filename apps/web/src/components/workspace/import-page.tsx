"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormStepper } from "@/components/ui/form-stepper";
import { CsvFilePicker } from "./csv-file-picker";
import { CsvPreviewTable } from "./csv-preview-table";
import { ColumnMapper } from "./column-mapper";
import { StatusMapper } from "./status-mapper";
import { ImportReview } from "./import-review";
import {
  IMPORT_PRESETS,
  parseCsvFile,
  autoMapColumns,
  mapStatus,
  validateMappedRows,
  transformToCsrImport,
} from "@/lib/csv-import";
import { trpc } from "@/lib/trpc";
import type {
  CsvImportPreset,
  ColumnMapping,
  StatusMapping,
  CsvImportValidation,
} from "@colophony/types";
import type { CSRImportResult } from "@colophony/types";
import type { ParsedCsv } from "@/lib/csv-import";

const STEPS = [
  { id: "file", title: "Select File" },
  { id: "columns", title: "Map Columns" },
  { id: "statuses", title: "Map Statuses" },
  { id: "review", title: "Review" },
];

export function ImportPage() {
  // --- Wizard state ---
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState<CsvImportPreset>("submittable");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [statusMappings, setStatusMappings] = useState<StatusMapping[]>([]);
  const [validation, setValidation] = useState<CsvImportValidation | null>(
    null,
  );
  const [importResult, setImportResult] = useState<CSRImportResult | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [duplicateCheckEnabled, setDuplicateCheckEnabled] = useState(false);

  const presetDef = IMPORT_PRESETS[preset];

  // --- Derived state ---
  const hasJournalNameMapping = columnMappings.some(
    (m) => m.target === "journalName",
  );
  const statusColumn = columnMappings.find((m) => m.target === "status");
  const uniqueStatuses = useMemo(() => {
    if (!parsed || !statusColumn) return [];
    const values = new Set<string>();
    for (const row of parsed.rows) {
      const val = row[statusColumn.csvHeader]?.trim();
      if (val) values.add(val);
    }
    return Array.from(values).sort();
  }, [parsed, statusColumn]);

  const completedSteps = useMemo(() => {
    const set = new Set<number>();
    if (parsed) set.add(0);
    if (hasJournalNameMapping) set.add(1);
    if (!statusColumn || statusMappings.length > 0) set.add(2);
    return set;
  }, [parsed, hasJournalNameMapping, statusColumn, statusMappings.length]);

  // --- Journal directory batch match ---
  const journalNames = useMemo(() => {
    if (!parsed || !hasJournalNameMapping) return [];
    const journalCol = columnMappings.find((m) => m.target === "journalName");
    if (!journalCol) return [];
    const names = new Set<string>();
    for (const row of parsed.rows) {
      const val = row[journalCol.csvHeader]?.trim();
      if (val) names.add(val);
    }
    return Array.from(names).slice(0, 200);
  }, [parsed, hasJournalNameMapping, columnMappings]);

  const batchMatchQuery = trpc.journalDirectory.batchMatch.useQuery(
    { names: journalNames },
    { enabled: step === 3 && journalNames.length > 0 },
  );

  // --- Duplicate check ---
  const duplicateCandidates = useMemo(() => {
    if (!parsed || !hasJournalNameMapping) return [];
    const journalCol = columnMappings.find((m) => m.target === "journalName");
    const sentAtCol = columnMappings.find((m) => m.target === "sentAt");
    if (!journalCol) return [];
    return parsed.rows
      .map((row) => ({
        journalName: row[journalCol.csvHeader]?.trim() ?? "",
        sentAt: sentAtCol
          ? (row[sentAtCol.csvHeader]?.trim() ?? undefined)
          : undefined,
      }))
      .filter((c) => c.journalName.length > 0);
  }, [parsed, hasJournalNameMapping, columnMappings]);

  const duplicateCheckQuery = trpc.externalSubmissions.checkDuplicates.useQuery(
    { candidates: duplicateCandidates },
    {
      enabled: duplicateCheckEnabled && duplicateCandidates.length > 0,
    },
  );

  // Merge duplicate warnings into validation at render time (no effect needed)
  const validationWithDuplicates = useMemo(() => {
    if (!validation) return null;
    if (!duplicateCheckQuery.data) return validation;
    return {
      ...validation,
      duplicateWarnings: duplicateCheckQuery.data.map((d) => ({
        rowIndex: d.candidateIndex,
        existingJournalName: d.existingJournalName,
        existingSentAt: d.existingSentAt,
      })),
    };
  }, [validation, duplicateCheckQuery.data]);

  // --- Import mutation ---
  const utils = trpc.useUtils();
  const importMutation = trpc.csr.import.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setImportError(null);
      utils.externalSubmissions.list.invalidate();
      utils.workspace.stats.invalidate();
      utils.workspace.portfolio.invalidate();
    },
    onError: (err) => {
      setImportError(err.message);
    },
  });

  // --- Handlers ---
  const handleFileSelected = useCallback(
    async (file: File) => {
      setParseError(null);
      try {
        const result = await parseCsvFile(file);
        if (result.headers.length === 0) {
          setParseError("CSV file has no headers");
          return;
        }
        if (result.rows.length === 0) {
          setParseError("CSV file has no data rows");
          return;
        }
        setParsed(result);

        // Auto-map columns
        const mappings = autoMapColumns(result.headers, presetDef);
        setColumnMappings(mappings);

        // Auto-map statuses
        if (presetDef.statusMappings.length > 0) {
          const statusCol = mappings.find((m) => m.target === "status");
          if (statusCol) {
            const values = new Set<string>();
            for (const row of result.rows) {
              const val = row[statusCol.csvHeader]?.trim();
              if (val) values.add(val);
            }
            const autoMappings: StatusMapping[] = Array.from(values).map(
              (csvValue) => ({
                csvValue,
                csrStatus: mapStatus(csvValue, presetDef.statusMappings),
              }),
            );
            setStatusMappings(autoMappings);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("CSV parse error:", err);
        setParseError(`Failed to parse CSV file: ${message}`);
      }
    },
    [presetDef],
  );

  const handlePresetChange = useCallback(
    (value: CsvImportPreset) => {
      setPreset(value);
      // Re-map if file already loaded
      if (parsed) {
        const newPreset = IMPORT_PRESETS[value];
        const mappings = autoMapColumns(parsed.headers, newPreset);
        setColumnMappings(mappings);

        const statusCol = mappings.find((m) => m.target === "status");
        if (statusCol && newPreset.statusMappings.length > 0) {
          const values = new Set<string>();
          for (const row of parsed.rows) {
            const val = row[statusCol.csvHeader]?.trim();
            if (val) values.add(val);
          }
          setStatusMappings(
            Array.from(values).map((csvValue) => ({
              csvValue,
              csrStatus: mapStatus(csvValue, newPreset.statusMappings),
            })),
          );
        } else {
          setStatusMappings([]);
        }
      }
    },
    [parsed],
  );

  const handleNext = useCallback(() => {
    if (step === 1 && !statusColumn) {
      // Skip status mapping step if no status column
      setStep(3);
      return;
    }
    if (step === 1 && statusColumn) {
      // Initialize status mappings if not yet done
      if (statusMappings.length === 0) {
        const values = new Set<string>();
        for (const row of parsed?.rows ?? []) {
          const val = row[statusColumn.csvHeader]?.trim();
          if (val) values.add(val);
        }
        setStatusMappings(
          Array.from(values).map((csvValue) => ({
            csvValue,
            csrStatus: mapStatus(csvValue, presetDef.statusMappings),
          })),
        );
      }
    }
    if (step === 2 || (step === 1 && !statusColumn)) {
      // Moving to review — run validation
      if (parsed) {
        const v = validateMappedRows(
          parsed.rows,
          columnMappings,
          statusMappings,
          presetDef.dateFormats,
        );
        setValidation(v);
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [step, statusColumn, statusMappings, parsed, columnMappings, presetDef]);

  const handleBack = useCallback(() => {
    if (step === 3 && !statusColumn) {
      // Skip back over status mapping
      setStep(1);
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  }, [step, statusColumn]);

  const handleImport = useCallback(() => {
    if (!parsed) return;

    // Build journal directory map from batch match
    const journalDirectoryMap = new Map<string, string>();
    if (batchMatchQuery.data) {
      for (const match of batchMatchQuery.data) {
        journalDirectoryMap.set(match.normalizedName, match.id);
      }
    }

    const input = transformToCsrImport(
      parsed.rows,
      columnMappings,
      statusMappings,
      presetDef.dateFormats,
      {
        importedFrom: presetDef.importedFrom,
        journalDirectoryMap,
      },
    );

    importMutation.mutate(input);
  }, [
    parsed,
    columnMappings,
    statusMappings,
    presetDef,
    batchMatchQuery.data,
    importMutation,
  ]);

  const handleReset = useCallback(() => {
    setStep(0);
    setParsed(null);
    setParseError(null);
    setColumnMappings([]);
    setStatusMappings([]);
    setValidation(null);
    setImportResult(null);
    setImportError(null);
    setDuplicateCheckEnabled(false);
  }, []);

  // --- Render ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Submissions</h1>
          <p className="text-muted-foreground">
            Bulk import submissions from CSV files
          </p>
        </div>
      </div>

      <FormStepper
        steps={STEPS}
        currentStepIndex={step}
        completedStepIndices={completedSteps}
        onStepClick={(i) => {
          if (i < step) setStep(i);
        }}
      />

      {/* Step 0: Select File */}
      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <Select
                  value={preset}
                  onValueChange={(v) =>
                    handlePresetChange(v as CsvImportPreset)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(IMPORT_PRESETS).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {presetDef.description}
                </p>
              </div>

              <CsvFilePicker onFileSelected={handleFileSelected} />

              {parseError && (
                <p className="text-sm text-destructive">{parseError}</p>
              )}

              {parsed && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Preview ({parsed.rows.length} rows)
                  </p>
                  <CsvPreviewTable
                    headers={parsed.headers}
                    rows={parsed.rows}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleNext} disabled={!parsed}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Map Columns */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Column Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <ColumnMapper
                headers={parsed?.headers ?? []}
                mappings={columnMappings}
                onMappingsChange={setColumnMappings}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={!hasJournalNameMapping}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Map Statuses */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusMapper
                uniqueStatuses={uniqueStatuses}
                mappings={statusMappings}
                onMappingsChange={setStatusMappings}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Import */}
      {step === 3 && (
        <div className="space-y-4">
          {!importResult && validation && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setDuplicateCheckEnabled(true)}
                disabled={
                  duplicateCheckQuery.isFetching || duplicateCheckEnabled
                }
              >
                {duplicateCheckQuery.isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {duplicateCheckQuery.data
                  ? `${duplicateCheckQuery.data.length} Duplicate${duplicateCheckQuery.data.length !== 1 ? "s" : ""} Found`
                  : duplicateCheckQuery.isFetching
                    ? "Checking..."
                    : "Check for Duplicates"}
              </Button>
            </div>
          )}

          {importResult ? (
            <div className="space-y-4">
              <ImportReview
                validation={validationWithDuplicates!}
                onImport={handleImport}
                onBack={handleBack}
                isPending={false}
                result={importResult}
              />
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleReset}>
                  Import More
                </Button>
                <Link href="/workspace/external">
                  <Button>View Submissions</Button>
                </Link>
              </div>
            </div>
          ) : (
            validationWithDuplicates && (
              <ImportReview
                validation={validationWithDuplicates}
                onImport={handleImport}
                onBack={handleBack}
                isPending={importMutation.isPending}
                error={importError}
              />
            )
          )}

          {batchMatchQuery.data && batchMatchQuery.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Journal Directory Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {batchMatchQuery.data.length} journal
                  {batchMatchQuery.data.length !== 1 ? "s" : ""} matched in the
                  directory. These will be linked automatically.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
