import { describe, it, expect } from "vitest";
import {
  writerStatusSchema,
  projectWriterStatus,
  resolveWriterStatusLabel,
  SUBMISSION_TO_WRITER_STATUS,
  WRITER_TO_INTERNAL_STATUSES,
  DEFAULT_WRITER_STATUS_LABELS,
  type WriterStatus,
} from "../writer-status";
import { submissionStatusSchema } from "../submission";

describe("writerStatusSchema", () => {
  it("has exactly 7 values", () => {
    expect(writerStatusSchema.options).toHaveLength(7);
  });

  it("does not include HOLD (collapsed into IN_REVIEW)", () => {
    expect(writerStatusSchema.options).not.toContain("HOLD");
  });

  it("does not include UNDER_REVIEW (mapped to IN_REVIEW)", () => {
    expect(writerStatusSchema.options).not.toContain("UNDER_REVIEW");
  });
});

describe("projectWriterStatus", () => {
  it("maps HOLD to IN_REVIEW (collapse)", () => {
    expect(projectWriterStatus("HOLD")).toBe("IN_REVIEW");
  });

  it("maps UNDER_REVIEW to IN_REVIEW", () => {
    expect(projectWriterStatus("UNDER_REVIEW")).toBe("IN_REVIEW");
  });

  it("maps REJECTED to DECISION_SENT (softening)", () => {
    expect(projectWriterStatus("REJECTED")).toBe("DECISION_SENT");
  });

  it("maps SUBMITTED to RECEIVED", () => {
    expect(projectWriterStatus("SUBMITTED")).toBe("RECEIVED");
  });

  it("maps REVISE_AND_RESUBMIT to REVISION_REQUESTED", () => {
    expect(projectWriterStatus("REVISE_AND_RESUBMIT")).toBe(
      "REVISION_REQUESTED",
    );
  });

  it("maps all 8 SubmissionStatus values to valid WriterStatus", () => {
    const allStatuses = submissionStatusSchema.options;
    for (const status of allStatuses) {
      const result = projectWriterStatus(status);
      expect(writerStatusSchema.safeParse(result).success).toBe(true);
    }
  });
});

describe("resolveWriterStatusLabel", () => {
  it("resolves default label when no overrides", () => {
    expect(resolveWriterStatusLabel("DECISION_SENT")).toBe("Decision Sent");
  });

  it("resolves default label when overrides is undefined", () => {
    expect(resolveWriterStatusLabel("DRAFT", undefined)).toBe("Draft");
  });

  it("resolves default label for missing override key", () => {
    expect(resolveWriterStatusLabel("DRAFT", {})).toBe("Draft");
  });

  it("uses org override when present", () => {
    expect(
      resolveWriterStatusLabel("DECISION_SENT", {
        DECISION_SENT: "Not Accepted",
      }),
    ).toBe("Not Accepted");
  });

  it("returns correct defaults for all statuses", () => {
    for (const [status, label] of Object.entries(
      DEFAULT_WRITER_STATUS_LABELS,
    )) {
      expect(resolveWriterStatusLabel(status as WriterStatus)).toBe(label);
    }
  });
});

describe("WRITER_TO_INTERNAL_STATUSES", () => {
  it("expands IN_REVIEW to UNDER_REVIEW + HOLD", () => {
    expect(WRITER_TO_INTERNAL_STATUSES.IN_REVIEW).toEqual([
      "UNDER_REVIEW",
      "HOLD",
    ]);
  });

  it("expands DECISION_SENT to REJECTED", () => {
    expect(WRITER_TO_INTERNAL_STATUSES.DECISION_SENT).toEqual(["REJECTED"]);
  });

  it("maps all WriterStatus values", () => {
    for (const status of writerStatusSchema.options) {
      expect(WRITER_TO_INTERNAL_STATUSES[status]).toBeDefined();
      expect(WRITER_TO_INTERNAL_STATUSES[status].length).toBeGreaterThan(0);
    }
  });

  it("covers all SubmissionStatus values exactly once", () => {
    const allInternal = Object.values(WRITER_TO_INTERNAL_STATUSES).flat();
    const allSubmissionStatuses = submissionStatusSchema.options;
    expect(allInternal.sort()).toEqual([...allSubmissionStatuses].sort());
  });
});

describe("SUBMISSION_TO_WRITER_STATUS (exhaustiveness)", () => {
  it("has a mapping for every SubmissionStatus", () => {
    for (const status of submissionStatusSchema.options) {
      expect(SUBMISSION_TO_WRITER_STATUS[status]).toBeDefined();
    }
  });
});
