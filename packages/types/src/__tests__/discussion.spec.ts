import { describe, it, expect } from "vitest";
import {
  submissionDiscussionSchema,
  createDiscussionCommentSchema,
} from "../discussion";

describe("submissionDiscussionSchema", () => {
  it("validates complete data", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      submissionId: "550e8400-e29b-41d4-a716-446655440001",
      authorId: "550e8400-e29b-41d4-a716-446655440002",
      authorEmail: "user@example.com",
      parentId: null,
      content: "<p>Test comment</p>",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: null,
    };

    const result = submissionDiscussionSchema.parse(data);
    expect(result.id).toBe(data.id);
    expect(result.authorEmail).toBe(data.authorEmail);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe("createDiscussionCommentSchema", () => {
  it("rejects empty content", () => {
    const result = createDiscussionCommentSchema.safeParse({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      content: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects content over 50000 characters", () => {
    const result = createDiscussionCommentSchema.safeParse({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      content: "x".repeat(50001),
    });

    expect(result.success).toBe(false);
  });

  it("accepts without parentId", () => {
    const result = createDiscussionCommentSchema.safeParse({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      content: "Valid comment",
    });

    expect(result.success).toBe(true);
  });

  it("accepts with parentId", () => {
    const result = createDiscussionCommentSchema.safeParse({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      parentId: "550e8400-e29b-41d4-a716-446655440001",
      content: "Valid reply",
    });

    expect(result.success).toBe(true);
  });
});
