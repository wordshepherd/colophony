import { toCsv, downloadFile } from "../csv-export";

describe("toCsv", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "age", label: "Age" },
  ];

  it("produces header row from column labels", () => {
    const csv = toCsv([], columns);
    expect(csv).toBe("Name,Email,Age");
  });

  it("produces data rows from row objects", () => {
    const rows = [{ name: "Alice", email: "alice@example.com", age: 30 }];
    const csv = toCsv(rows, columns);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Alice,alice@example.com,30");
  });

  it("escapes fields containing commas", () => {
    const rows = [{ name: "Doe, Jane", email: "jane@example.com", age: 25 }];
    const csv = toCsv(rows, columns);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"Doe, Jane",jane@example.com,25');
  });

  it("escapes fields containing double quotes", () => {
    const rows = [
      { name: 'She said "hello"', email: "test@test.com", age: 20 },
    ];
    const csv = toCsv(rows, columns);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"She said ""hello""",test@test.com,20');
  });

  it("handles null values as empty strings", () => {
    const rows = [{ name: null, email: "test@test.com", age: undefined }];
    const csv = toCsv(rows as unknown as Record<string, unknown>[], columns);
    const lines = csv.split("\n");
    expect(lines[1]).toBe(",test@test.com,");
  });

  it("JSON-stringifies object values", () => {
    const rows = [{ name: "Bob", email: "bob@test.com", age: { years: 30 } }];
    const csv = toCsv(rows as unknown as Record<string, unknown>[], columns);
    const lines = csv.split("\n");
    // JSON contains commas so it should be quoted
    expect(lines[1]).toContain('"{""years"":30}"');
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
