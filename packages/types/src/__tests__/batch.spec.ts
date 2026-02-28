import { describe, it, expect } from "vitest";
import {
  batchStatusChangeInputSchema,
  batchAssignReviewersInputSchema,
  batchStatusChangeResponseSchema,
  batchAssignReviewersResponseSchema,
} from "../submission";

const uuid = () => "550e8400-e29b-41d4-a716-446655440000";

describe("batchStatusChangeInputSchema", () => {
  it("accepts valid input", () => {
    const result = batchStatusChangeInputSchema.parse({
      submissionIds: [uuid()],
      status: "UNDER_REVIEW",
    });
    expect(result.submissionIds).toHaveLength(1);
    expect(result.status).toBe("UNDER_REVIEW");
    expect(result.comment).toBeUndefined();
  });

  it("accepts valid input with comment", () => {
    const result = batchStatusChangeInputSchema.parse({
      submissionIds: [uuid()],
      status: "REJECTED",
      comment: "Not a fit for this issue",
    });
    expect(result.comment).toBe("Not a fit for this issue");
  });

  it("rejects empty submissionIds array", () => {
    expect(() =>
      batchStatusChangeInputSchema.parse({
        submissionIds: [],
        status: "UNDER_REVIEW",
      }),
    ).toThrow();
  });

  it("rejects more than 50 submissionIds", () => {
    const ids = Array.from({ length: 51 }, () => uuid());
    expect(() =>
      batchStatusChangeInputSchema.parse({
        submissionIds: ids,
        status: "UNDER_REVIEW",
      }),
    ).toThrow();
  });

  it("rejects invalid status", () => {
    expect(() =>
      batchStatusChangeInputSchema.parse({
        submissionIds: [uuid()],
        status: "INVALID",
      }),
    ).toThrow();
  });
});

describe("batchAssignReviewersInputSchema", () => {
  it("accepts valid input", () => {
    const result = batchAssignReviewersInputSchema.parse({
      submissionIds: [uuid()],
      reviewerUserIds: [uuid()],
    });
    expect(result.submissionIds).toHaveLength(1);
    expect(result.reviewerUserIds).toHaveLength(1);
  });

  it("rejects empty reviewerUserIds", () => {
    expect(() =>
      batchAssignReviewersInputSchema.parse({
        submissionIds: [uuid()],
        reviewerUserIds: [],
      }),
    ).toThrow();
  });

  it("rejects more than 20 reviewerUserIds", () => {
    const ids = Array.from({ length: 21 }, () => uuid());
    expect(() =>
      batchAssignReviewersInputSchema.parse({
        submissionIds: [uuid()],
        reviewerUserIds: ids,
      }),
    ).toThrow();
  });
});

describe("batchStatusChangeResponseSchema", () => {
  it("parses all-success response", () => {
    const result = batchStatusChangeResponseSchema.parse({
      succeeded: [
        {
          submissionId: uuid(),
          previousStatus: "SUBMITTED",
          status: "UNDER_REVIEW",
        },
      ],
      failed: [],
    });
    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });

  it("parses partial failure response", () => {
    const result = batchStatusChangeResponseSchema.parse({
      succeeded: [
        {
          submissionId: uuid(),
          previousStatus: "SUBMITTED",
          status: "UNDER_REVIEW",
        },
      ],
      failed: [{ submissionId: uuid(), error: "Invalid transition" }],
    });
    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toBe("Invalid transition");
  });

  it("parses all-failed response", () => {
    const result = batchStatusChangeResponseSchema.parse({
      succeeded: [],
      failed: [{ submissionId: uuid(), error: "Not found" }],
    });
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });
});

describe("batchAssignReviewersResponseSchema", () => {
  it("parses valid response", () => {
    const result = batchAssignReviewersResponseSchema.parse({
      succeeded: [{ submissionId: uuid(), assignedCount: 3 }],
      failed: [{ submissionId: uuid(), error: "Submission not found" }],
    });
    expect(result.succeeded).toHaveLength(1);
    expect(result.succeeded[0].assignedCount).toBe(3);
    expect(result.failed).toHaveLength(1);
  });
});
