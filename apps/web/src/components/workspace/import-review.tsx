"use client";

import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CsvImportValidation } from "@colophony/types";
import type { CSRImportResult } from "@colophony/types";

interface ImportReviewProps {
  validation: CsvImportValidation;
  onImport: () => void;
  onBack: () => void;
  isPending: boolean;
  result?: CSRImportResult | null;
  error?: string | null;
}

export function ImportReview({
  validation,
  onImport,
  onBack,
  isPending,
  result,
  error,
}: ImportReviewProps) {
  const errorCount = validation.errorRows.filter(
    (r) => r.errors.length > 0,
  ).length;
  const warningCount = validation.errorRows.filter(
    (r) => r.warnings.length > 0 && r.errors.length === 0,
  ).length;
  const duplicateCount = validation.duplicateWarnings.length;

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Import Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <strong>{result.submissionsCreated}</strong> submission
            {result.submissionsCreated !== 1 ? "s" : ""} imported.
          </p>
          {result.correspondenceCreated > 0 && (
            <p>
              <strong>{result.correspondenceCreated}</strong> correspondence
              record{result.correspondenceCreated !== 1 ? "s" : ""} imported.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                <strong>{validation.validRows}</strong> valid rows
              </span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm">
                  <strong>{errorCount}</strong> row
                  {errorCount !== 1 ? "s" : ""} with errors (will be skipped)
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">
                  <strong>{warningCount}</strong> row
                  {warningCount !== 1 ? "s" : ""} with warnings
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error details */}
      {errorCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Errors ({errorCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validation.errorRows
                    .filter((r) => r.errors.length > 0)
                    .slice(0, 20)
                    .map((row) => (
                      <TableRow key={row.rowIndex}>
                        <TableCell className="text-sm">
                          {row.rowIndex + 1}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.errors.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning details */}
      {warningCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-yellow-600">
              Warnings ({warningCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead>Warning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validation.errorRows
                    .filter(
                      (r) => r.warnings.length > 0 && r.errors.length === 0,
                    )
                    .slice(0, 20)
                    .map((row) => (
                      <TableRow key={row.rowIndex}>
                        <TableCell className="text-sm">
                          {row.rowIndex + 1}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.warnings.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate warnings */}
      {duplicateCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-yellow-600">
              Possible Duplicates ({duplicateCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead>Journal</TableHead>
                    <TableHead>Existing Sent Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validation.duplicateWarnings.slice(0, 20).map((dup) => (
                    <TableRow key={dup.rowIndex}>
                      <TableCell className="text-sm">
                        {dup.rowIndex + 1}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dup.existingJournalName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dup.existingSentAt ?? "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <Button
          onClick={onImport}
          disabled={isPending || validation.validRows === 0}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Import {validation.validRows} Submission
          {validation.validRows !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
