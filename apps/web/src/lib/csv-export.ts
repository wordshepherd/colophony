interface CsvColumn {
  key: string;
  label: string;
}

/**
 * Convert an array of row objects to a CSV string.
 * Handles proper CSV escaping for commas, quotes, and newlines.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  const header = columns.map((c) => escapeField(c.label)).join(",");

  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return "";
        if (typeof value === "object")
          return escapeField(JSON.stringify(value));
        return escapeField(String(value));
      })
      .join(","),
  );

  return [header, ...dataRows].join("\n");
}

function escapeField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a file download in the browser by creating a temporary anchor element.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
