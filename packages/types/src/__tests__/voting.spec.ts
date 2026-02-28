import { describe, it, expect } from "vitest";
import {
  submissionVoteSchema,
  castVoteInputSchema,
  votingConfigSchema,
  voteSummarySchema,
} from "../voting";

describe("submissionVoteSchema", () => {
  it("parses valid vote", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      submissionId: "550e8400-e29b-41d4-a716-446655440001",
      voterUserId: "550e8400-e29b-41d4-a716-446655440002",
      voterEmail: "voter@example.com",
      decision: "ACCEPT",
      score: 8.5,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const result = submissionVoteSchema.parse(data);
    expect(result.id).toBe(data.id);
    expect(result.decision).toBe("ACCEPT");
    expect(result.score).toBe(8.5);
  });

  it("coerces date strings", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      submissionId: "550e8400-e29b-41d4-a716-446655440001",
      voterUserId: "550e8400-e29b-41d4-a716-446655440002",
      voterEmail: null,
      decision: "REJECT",
      score: null,
      createdAt: "2024-06-15T12:00:00Z",
      updatedAt: "2024-06-15T13:00:00Z",
    };

    const result = submissionVoteSchema.parse(data);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

describe("castVoteInputSchema", () => {
  it("accepts valid decisions", () => {
    for (const decision of ["ACCEPT", "REJECT", "MAYBE"]) {
      const result = castVoteInputSchema.safeParse({
        submissionId: "550e8400-e29b-41d4-a716-446655440000",
        decision,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid decision", () => {
    const result = castVoteInputSchema.safeParse({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      decision: "ABSTAIN",
    });
    expect(result.success).toBe(false);
  });
});

describe("votingConfigSchema", () => {
  it("defaults missing fields", () => {
    const result = votingConfigSchema.parse({});
    expect(result).toEqual({
      votingEnabled: false,
      scoringEnabled: false,
      scoreMin: 1,
      scoreMax: 10,
    });
  });
});

describe("voteSummarySchema", () => {
  it("parses with null averageScore", () => {
    const data = {
      acceptCount: 3,
      rejectCount: 1,
      maybeCount: 2,
      totalVotes: 6,
      averageScore: null,
    };

    const result = voteSummarySchema.parse(data);
    expect(result.totalVotes).toBe(6);
    expect(result.averageScore).toBeNull();
  });
});
