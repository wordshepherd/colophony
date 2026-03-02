import {
  parseCsvFile,
  autoMapColumns,
  tryParseDate,
  mapStatus,
  validateMappedRows,
  transformToCsrImport,
  IMPORT_PRESETS,
} from "../csv-import";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(content: string, name = "test.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

// ---------------------------------------------------------------------------
// parseCsvFile
// ---------------------------------------------------------------------------

describe("parseCsvFile", () => {
  it("parses simple CSV with headers", async () => {
    const file = makeFile("Name,Email\nAlice,alice@example.com\n");
    const result = await parseCsvFile(file);
    expect(result.headers).toEqual(["Name", "Email"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      Name: "Alice",
      Email: "alice@example.com",
    });
  });

  it("handles quoted fields with commas", async () => {
    const file = makeFile('Name,Location\n"Doe, Jane","New York, NY"\n');
    const result = await parseCsvFile(file);
    expect(result.rows[0].Name).toBe("Doe, Jane");
    expect(result.rows[0].Location).toBe("New York, NY");
  });

  it("filters empty trailing rows", async () => {
    const file = makeFile("Name\nAlice\n\n\n\n");
    const result = await parseCsvFile(file);
    expect(result.rows).toHaveLength(1);
  });

  it("strips UTF-8 BOM", async () => {
    const file = makeFile("\uFEFFName,Status\nAlice,Sent\n");
    const result = await parseCsvFile(file);
    expect(result.headers[0]).toBe("Name");
  });
});

// ---------------------------------------------------------------------------
// autoMapColumns
// ---------------------------------------------------------------------------

describe("autoMapColumns", () => {
  it("auto-maps Submittable columns", () => {
    const headers = [
      "Publication",
      "Status",
      "Date Submitted",
      "Last Activity",
      "Notes",
    ];
    const mappings = autoMapColumns(headers, IMPORT_PRESETS.submittable);
    expect(mappings.find((m) => m.csvHeader === "Publication")?.target).toBe(
      "journalName",
    );
    expect(mappings.find((m) => m.csvHeader === "Status")?.target).toBe(
      "status",
    );
    expect(mappings.find((m) => m.csvHeader === "Date Submitted")?.target).toBe(
      "sentAt",
    );
    expect(mappings.find((m) => m.csvHeader === "Last Activity")?.target).toBe(
      "respondedAt",
    );
    expect(mappings.find((m) => m.csvHeader === "Notes")?.target).toBe("notes");
  });

  it("auto-maps Chill Subs columns", () => {
    const headers = [
      "Journal",
      "Status",
      "Date Sent",
      "Date Responded",
      "Notes",
      "Link",
    ];
    const mappings = autoMapColumns(headers, IMPORT_PRESETS.chillsubs);
    expect(mappings.find((m) => m.csvHeader === "Journal")?.target).toBe(
      "journalName",
    );
    expect(mappings.find((m) => m.csvHeader === "Status")?.target).toBe(
      "status",
    );
    expect(mappings.find((m) => m.csvHeader === "Date Sent")?.target).toBe(
      "sentAt",
    );
    expect(mappings.find((m) => m.csvHeader === "Date Responded")?.target).toBe(
      "respondedAt",
    );
    expect(mappings.find((m) => m.csvHeader === "Link")?.target).toBe("skip");
  });

  it("marks unrecognized columns as skip", () => {
    const headers = ["Unknown Column"];
    const mappings = autoMapColumns(headers, IMPORT_PRESETS.submittable);
    expect(mappings[0].target).toBe("skip");
  });

  it("handles case-insensitive matching", () => {
    const headers = ["PUBLICATION", "STATUS"];
    const mappings = autoMapColumns(headers, IMPORT_PRESETS.submittable);
    expect(mappings[0].target).toBe("journalName");
    expect(mappings[1].target).toBe("status");
  });
});

// ---------------------------------------------------------------------------
// tryParseDate
// ---------------------------------------------------------------------------

describe("tryParseDate", () => {
  const formats = IMPORT_PRESETS.submittable.dateFormats;

  it("parses ISO date", () => {
    const result = tryParseDate("2024-01-15", formats);
    expect(result).not.toBeNull();
    expect(new Date(result!).getFullYear()).toBe(2024);
  });

  it("parses US date with time", () => {
    const result = tryParseDate("01/15/2024 03:45 PM", formats);
    expect(result).not.toBeNull();
    expect(new Date(result!).getFullYear()).toBe(2024);
  });

  it("returns null for unparseable", () => {
    expect(tryParseDate("not a date", formats)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(tryParseDate("", formats)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapStatus
// ---------------------------------------------------------------------------

describe("mapStatus", () => {
  const mappings = IMPORT_PRESETS.submittable.statusMappings;

  it("maps known Submittable status", () => {
    expect(mapStatus("Accepted", mappings)).toBe("accepted");
  });

  it("returns unknown for unmapped", () => {
    expect(mapStatus("Limbo", mappings)).toBe("unknown");
  });

  it("case-insensitive trim", () => {
    expect(mapStatus(" declined ", mappings)).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// validateMappedRows
// ---------------------------------------------------------------------------

describe("validateMappedRows", () => {
  const columnMappings = [
    { csvHeader: "Journal", target: "journalName" as const },
    { csvHeader: "Status", target: "status" as const },
    { csvHeader: "Date Sent", target: "sentAt" as const },
  ];
  const statusMappings = IMPORT_PRESETS.chillsubs.statusMappings;
  const dateFormats = IMPORT_PRESETS.chillsubs.dateFormats;

  it("all valid rows", () => {
    const rows = [
      { Journal: "Paris Review", Status: "Pending", "Date Sent": "2024-01-15" },
      { Journal: "Granta", Status: "Accepted", "Date Sent": "2024-02-01" },
      {
        Journal: "Ploughshares",
        Status: "Rejected",
        "Date Sent": "2024-03-10",
      },
    ];
    const result = validateMappedRows(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
    );
    expect(result.validRows).toBe(3);
    expect(result.errorRows.filter((r) => r.errors.length > 0)).toHaveLength(0);
  });

  it("flags missing journalName", () => {
    const rows = [
      { Journal: "", Status: "Pending", "Date Sent": "2024-01-15" },
    ];
    const result = validateMappedRows(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
    );
    expect(result.validRows).toBe(0);
    expect(result.errorRows[0].errors).toContain("Journal name is required");
  });

  it("flags invalid dates as warnings", () => {
    const rows = [
      { Journal: "Paris Review", Status: "Pending", "Date Sent": "garbage" },
    ];
    const result = validateMappedRows(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
    );
    // Row is still valid (warnings don't block)
    expect(result.validRows).toBe(1);
    expect(result.errorRows[0].warnings[0]).toMatch(/Could not parse/);
  });
});

// ---------------------------------------------------------------------------
// transformToCsrImport
// ---------------------------------------------------------------------------

describe("transformToCsrImport", () => {
  const columnMappings = [
    { csvHeader: "Journal", target: "journalName" as const },
    { csvHeader: "Status", target: "status" as const },
    { csvHeader: "Date Sent", target: "sentAt" as const },
    { csvHeader: "Notes", target: "notes" as const },
    { csvHeader: "Extra", target: "skip" as const },
  ];
  const statusMappings = IMPORT_PRESETS.chillsubs.statusMappings;
  const dateFormats = IMPORT_PRESETS.chillsubs.dateFormats;

  it("transforms valid rows", () => {
    const rows = [
      {
        Journal: "Paris Review",
        Status: "Pending",
        "Date Sent": "2024-01-15",
        Notes: "Good fit",
        Extra: "ignored",
      },
      {
        Journal: "Granta",
        Status: "Accepted",
        "Date Sent": "2024-02-01",
        Notes: "",
        Extra: "ignored",
      },
    ];
    const result = transformToCsrImport(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
      {
        importedFrom: "chillsubs",
      },
    );
    expect(result.submissions).toHaveLength(2);
    expect(result.submissions[0].journalName).toBe("Paris Review");
    expect(result.submissions[0].status).toBe("sent");
    expect(result.submissions[1].status).toBe("accepted");
  });

  it("applies journalDirectoryMap", () => {
    const rows = [
      {
        Journal: "Paris Review",
        Status: "Pending",
        "Date Sent": "2024-01-15",
        Notes: "",
        Extra: "",
      },
    ];
    const dirMap = new Map([["paris review", "uuid-123"]]);
    const result = transformToCsrImport(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
      {
        importedFrom: "chillsubs",
        journalDirectoryMap: dirMap,
      },
    );
    expect(result.submissions[0].journalDirectoryId).toBe("uuid-123");
  });

  it("sets importedFrom", () => {
    const rows = [
      {
        Journal: "Granta",
        Status: "Accepted",
        "Date Sent": "2024-02-01",
        Notes: "",
        Extra: "",
      },
    ];
    const result = transformToCsrImport(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
      {
        importedFrom: "chillsubs",
      },
    );
    expect(result.submissions[0].importedFrom).toBe("chillsubs");
    expect(result.importedFrom).toBe("chillsubs");
  });

  it("skips columns mapped to skip", () => {
    const rows = [
      {
        Journal: "Granta",
        Status: "Accepted",
        "Date Sent": "2024-02-01",
        Notes: "",
        Extra: "should not appear",
      },
    ];
    const result = transformToCsrImport(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
      {
        importedFrom: "test",
      },
    );
    const sub = result.submissions[0];
    expect(sub).not.toHaveProperty("Extra");
    expect(Object.keys(sub)).not.toContain("Extra");
  });

  it("handles empty optional fields", () => {
    const rows = [
      {
        Journal: "Granta",
        Status: "Accepted",
        "Date Sent": "",
        Notes: "",
        Extra: "",
      },
    ];
    const result = transformToCsrImport(
      rows,
      columnMappings,
      statusMappings,
      dateFormats,
      {
        importedFrom: "test",
      },
    );
    const sub = result.submissions[0];
    expect(sub.notes).toBeUndefined();
    expect(sub.sentAt).toBeUndefined();
  });
});
