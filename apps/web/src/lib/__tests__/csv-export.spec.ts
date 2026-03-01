import { toCsv, downloadFile } from "../csv-export";

/** Strip the UTF-8 BOM prefix from CSV output for easier assertions. */
function stripBom(csv: string): string {
  return csv.replace(/^\uFEFF/, "");
}

describe("toCsv", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "age", label: "Age" },
  ];

  it("produces header row from column labels", () => {
    const csv = stripBom(toCsv([], columns));
    expect(csv).toBe("Name,Email,Age");
  });

  it("prepends UTF-8 BOM for Excel compatibility", () => {
    const csv = toCsv([], columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("produces data rows from row objects", () => {
    const rows = [{ name: "Alice", email: "alice@example.com", age: 30 }];
    const csv = stripBom(toCsv(rows, columns));
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Alice,alice@example.com,30");
  });

  it("escapes fields containing commas", () => {
    const rows = [{ name: "Doe, Jane", email: "jane@example.com", age: 25 }];
    const csv = stripBom(toCsv(rows, columns));
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"Doe, Jane",jane@example.com,25');
  });

  it("escapes fields containing double quotes", () => {
    const rows = [
      { name: 'She said "hello"', email: "test@test.com", age: 20 },
    ];
    const csv = stripBom(toCsv(rows, columns));
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"She said ""hello""",test@test.com,20');
  });

  it("handles null values as empty strings", () => {
    const rows = [{ name: null, email: "test@test.com", age: undefined }];
    const csv = stripBom(
      toCsv(rows as unknown as Record<string, unknown>[], columns),
    );
    const lines = csv.split("\n");
    expect(lines[1]).toBe(",test@test.com,");
  });

  it("JSON-stringifies object values", () => {
    const rows = [{ name: "Bob", email: "bob@test.com", age: { years: 30 } }];
    const csv = stripBom(
      toCsv(rows as unknown as Record<string, unknown>[], columns),
    );
    const lines = csv.split("\n");
    // JSON contains commas so it should be quoted
    expect(lines[1]).toContain('"{""years"":30}"');
  });

  it("prevents CSV formula injection by prefixing with single quote", () => {
    const formulaPrefixes = ["=cmd", "+SUM(A1)", "-1+1", "@SUM(A1)"];
    for (const prefix of formulaPrefixes) {
      const rows = [{ name: prefix, email: "test@test.com", age: 1 }];
      const csv = stripBom(
        toCsv(rows as unknown as Record<string, unknown>[], columns),
      );
      const lines = csv.split("\n");
      // Formula-triggering values should be quoted and prefixed with '
      expect(lines[1]).toMatch(/^"'/);
      expect(lines[1]).not.toMatch(/^[=+\-@|]/);
    }
  });
});

describe("downloadFile", () => {
  it("creates and clicks a temporary anchor element", () => {
    const createObjectURL = jest.fn(() => "blob:test-url");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis, "URL", {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
      configurable: true,
    });

    const clickSpy = jest.fn();
    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const removeChildSpy = jest.spyOn(document.body, "removeChild");

    // Mock createElement to spy on click
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    downloadFile("test content", "test.csv", "text/csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    (document.createElement as jest.Mock).mockRestore();
  });
});
