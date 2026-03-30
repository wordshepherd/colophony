import { describe, it, expect } from "vitest";
import {
  readerFeedbackSettingsSchema,
  createReaderFeedbackSchema,
  forwardReaderFeedbackSchema,
  listReaderFeedbackSchema,
} from "../reader-feedback";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("readerFeedbackSettingsSchema", () => {
  it("applies defaults", () => {
    const result = readerFeedbackSettingsSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.availableTags).toEqual([]);
  });

  it("accepts configured tags", () => {
    const result = readerFeedbackSettingsSchema.parse({
      enabled: true,
      availableTags: ["voice", "imagery", "structure"],
    });
    expect(result.enabled).toBe(true);
    expect(result.availableTags).toHaveLength(3);
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(() =>
      readerFeedbackSettingsSchema.parse({ availableTags: tags }),
    ).toThrow();
  });
});

describe("createReaderFeedbackSchema", () => {
  it("parses valid input", () => {
    const result = createReaderFeedbackSchema.parse({
      submissionId: UUID,
      tags: ["voice"],
      comment: "Strong opening",
    });
    expect(result.submissionId).toBe(UUID);
    expect(result.tags).toEqual(["voice"]);
    expect(result.comment).toBe("Strong opening");
  });

  it("defaults isForwardable to false", () => {
    const result = createReaderFeedbackSchema.parse({
      submissionId: UUID,
    });
    expect(result.isForwardable).toBe(false);
  });

  it("rejects comment over 280 chars", () => {
    expect(() =>
      createReaderFeedbackSchema.parse({
        submissionId: UUID,
        comment: "x".repeat(281),
      }),
    ).toThrow();
  });

  it("rejects too many tags", () => {
    expect(() =>
      createReaderFeedbackSchema.parse({
        submissionId: UUID,
        tags: ["a", "b", "c", "d", "e", "f"],
      }),
    ).toThrow();
  });
});

describe("forwardReaderFeedbackSchema", () => {
  it("parses valid input", () => {
    const result = forwardReaderFeedbackSchema.parse({ feedbackId: UUID });
    expect(result.feedbackId).toBe(UUID);
  });

  it("rejects non-uuid", () => {
    expect(() =>
      forwardReaderFeedbackSchema.parse({ feedbackId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("listReaderFeedbackSchema", () => {
  it("parses valid input with defaults", () => {
    const result = listReaderFeedbackSchema.parse({ submissionId: UUID });
    expect(result.submissionId).toBe(UUID);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
