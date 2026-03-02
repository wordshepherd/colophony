"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CsvPreviewTableProps {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
}

export function CsvPreviewTable({
  headers,
  rows,
  maxRows = 5,
}: CsvPreviewTableProps) {
  const displayRows = rows.slice(0, maxRows);
  const remaining = rows.length - displayRows.length;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header} className="whitespace-nowrap text-xs">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, i) => (
              <TableRow key={i}>
                {headers.map((header) => (
                  <TableCell
                    key={header}
                    className="max-w-[200px] truncate text-xs"
                  >
                    {row[header] || ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          and {remaining} more row{remaining !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
