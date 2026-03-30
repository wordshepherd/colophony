import { describe, it, expect } from "vitest";
import {
  portfolioEntryTypeSchema,
  createPortfolioEntrySchema,
  updatePortfolioEntrySchema,
  listPortfolioEntriesSchema,
} from "../portfolio-entry";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("portfolioEntryTypeSchema", () => {
  it("accepts valid types", () => {
    expect(portfolioEntryTypeSchema.parse("colophony_verified")).toBe(
      "colophony_verified",
    );
    expect(portfolioEntryTypeSchema.parse("federation_verified")).toBe(
      "federation_verified",
    );
    expect(portfolioEntryTypeSchema.parse("external")).toBe("external");
  });

  it("rejects invalid type", () => {
    expect(() => portfolioEntryTypeSchema.parse("unknown")).toThrow();
  });
});

describe("createPortfolioEntrySchema", () => {
  it("parses valid input", () => {
    const result = createPortfolioEntrySchema.parse({
      title: "My Poem",
      publicationName: "Poetry Magazine",
    });
    expect(result.title).toBe("My Poem");
    expect(result.publicationName).toBe("Poetry Magazine");
  });

  it("accepts optional url", () => {
    const result = createPortfolioEntrySchema.parse({
      title: "My Poem",
      publicationName: "Poetry Magazine",
      url: "https://example.com/poem",
    });
    expect(result.url).toBe("https://example.com/poem");
  });

  it("rejects invalid url", () => {
    expect(() =>
      createPortfolioEntrySchema.parse({
        title: "My Poem",
        publicationName: "Poetry Magazine",
        url: "not-a-url",
      }),
    ).toThrow();
  });
});

describe("updatePortfolioEntrySchema", () => {
  it("accepts partial update", () => {
    const result = updatePortfolioEntrySchema.parse({
      id: UUID,
      title: "New Title",
    });
    expect(result.title).toBe("New Title");
  });

  it("rejects update with no fields", () => {
    expect(() => updatePortfolioEntrySchema.parse({ id: UUID })).toThrow();
  });
});

describe("listPortfolioEntriesSchema", () => {
  it("applies defaults", () => {
    const result = listPortfolioEntriesSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("accepts type filter", () => {
    const result = listPortfolioEntriesSchema.parse({ type: "external" });
    expect(result.type).toBe("external");
  });
});
