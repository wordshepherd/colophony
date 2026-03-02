"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ColumnMapping, CsrTargetField } from "@colophony/types";

const TARGET_OPTIONS: Array<{ value: CsrTargetField; label: string }> = [
  { value: "journalName", label: "Journal Name *" },
  { value: "status", label: "Status" },
  { value: "sentAt", label: "Date Sent" },
  { value: "respondedAt", label: "Date Responded" },
  { value: "method", label: "Method" },
  { value: "notes", label: "Notes" },
  { value: "skip", label: "Skip" },
];

interface ColumnMapperProps {
  headers: string[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

export function ColumnMapper({
  headers,
  mappings,
  onMappingsChange,
}: ColumnMapperProps) {
  const hasJournalName = mappings.some((m) => m.target === "journalName");

  const handleChange = (csvHeader: string, target: CsrTargetField) => {
    const updated = mappings.map((m) =>
      m.csvHeader === csvHeader ? { ...m, target } : m,
    );
    onMappingsChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Map each CSV column to a submission field.
        </p>
        {!hasJournalName && (
          <p className="text-sm text-destructive">
            Journal Name mapping is required
          </p>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">CSV Column</TableHead>
              <TableHead className="w-1/2">Maps To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header) => {
              const mapping = mappings.find((m) => m.csvHeader === header);
              const currentTarget = mapping?.target ?? "skip";

              return (
                <TableRow key={header}>
                  <TableCell className="font-mono text-sm">{header}</TableCell>
                  <TableCell>
                    <Select
                      value={currentTarget}
                      onValueChange={(val) =>
                        handleChange(header, val as CsrTargetField)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
