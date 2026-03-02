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
import { CsrStatusBadge } from "./csr-status-badge";
import { CSR_STATUS_OPTIONS } from "@/lib/csv-import";
import type { StatusMapping } from "@colophony/types";
import type { CSRStatus } from "@colophony/types";

interface StatusMapperProps {
  uniqueStatuses: string[];
  mappings: StatusMapping[];
  onMappingsChange: (mappings: StatusMapping[]) => void;
}

export function StatusMapper({
  uniqueStatuses,
  mappings,
  onMappingsChange,
}: StatusMapperProps) {
  const handleChange = (csvValue: string, csrStatus: CSRStatus) => {
    const updated = mappings.map((m) =>
      m.csvValue === csvValue ? { ...m, csrStatus } : m,
    );
    onMappingsChange(updated);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Map each status value from your CSV to a submission status.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">CSV Status</TableHead>
              <TableHead className="w-1/3">Maps To</TableHead>
              <TableHead className="w-1/3">Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueStatuses.map((csvValue) => {
              const mapping = mappings.find((m) => m.csvValue === csvValue);
              const currentStatus = mapping?.csrStatus ?? "unknown";

              return (
                <TableRow key={csvValue}>
                  <TableCell className="font-mono text-sm">
                    {csvValue}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={currentStatus}
                      onValueChange={(val) =>
                        handleChange(csvValue, val as CSRStatus)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CSR_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <CsrStatusBadge status={currentStatus} />
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
