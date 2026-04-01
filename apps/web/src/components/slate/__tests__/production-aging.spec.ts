import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getAgingStatus,
  getDeadlineForStage,
  getHandoffStatus,
  getAgingColor,
  getAgingLabel,
} from "../production-aging";
import type { PipelineStage } from "@colophony/types";

function makeItem(
  stage: PipelineStage,
  overrides: {
    copyeditDueAt?: Date | null;
    proofreadDueAt?: Date | null;
    authorReviewDueAt?: Date | null;
  } = {},
) {
  return {
    stage,
    copyeditDueAt: overrides.copyeditDueAt ?? null,
    proofreadDueAt: overrides.proofreadDueAt ?? null,
    authorReviewDueAt: overrides.authorReviewDueAt ?? null,
  };
}

describe("getAgingStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns on-track when well before deadline", () => {
    const dueAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days out
    expect(getAgingStatus(2, dueAt)).toBe("on-track");
  });

  it("returns at-risk when approaching deadline (1-3 days)", () => {
    const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days out
    expect(getAgingStatus(5, dueAt)).toBe("at-risk");
  });

  it("returns overdue when past deadline", () => {
    const dueAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    expect(getAgingStatus(8, dueAt)).toBe("overdue");
  });

  it("uses fixed thresholds when no deadline: on-track <5d", () => {
    expect(getAgingStatus(3, null)).toBe("on-track");
  });

  it("uses fixed thresholds when no deadline: at-risk 5-10d", () => {
    expect(getAgingStatus(7, null)).toBe("at-risk");
  });

  it("uses fixed thresholds when no deadline: overdue >10d", () => {
    expect(getAgingStatus(11, null)).toBe("overdue");
  });
});

describe("getDeadlineForStage", () => {
  const copyeditDue = new Date("2026-04-01");
  const proofreadDue = new Date("2026-04-15");
  const authorReviewDue = new Date("2026-04-10");

  it("returns copyeditDueAt for COPYEDIT_PENDING", () => {
    const item = makeItem("COPYEDIT_PENDING", { copyeditDueAt: copyeditDue });
    expect(getDeadlineForStage(item)).toBe(copyeditDue);
  });

  it("returns copyeditDueAt for COPYEDIT_IN_PROGRESS", () => {
    const item = makeItem("COPYEDIT_IN_PROGRESS", {
      copyeditDueAt: copyeditDue,
    });
    expect(getDeadlineForStage(item)).toBe(copyeditDue);
  });

  it("returns authorReviewDueAt for AUTHOR_REVIEW", () => {
    const item = makeItem("AUTHOR_REVIEW", {
      authorReviewDueAt: authorReviewDue,
    });
    expect(getDeadlineForStage(item)).toBe(authorReviewDue);
  });

  it("returns proofreadDueAt for PROOFREAD", () => {
    const item = makeItem("PROOFREAD", { proofreadDueAt: proofreadDue });
    expect(getDeadlineForStage(item)).toBe(proofreadDue);
  });

  it("returns null for READY_TO_PUBLISH", () => {
    const item = makeItem("READY_TO_PUBLISH");
    expect(getDeadlineForStage(item)).toBeNull();
  });

  it("returns null for PUBLISHED", () => {
    const item = makeItem("PUBLISHED");
    expect(getDeadlineForStage(item)).toBeNull();
  });
});

describe("getHandoffStatus", () => {
  it("returns waiting-external for AUTHOR_REVIEW", () => {
    expect(getHandoffStatus("AUTHOR_REVIEW")).toBe("waiting-external");
  });

  it("returns internal for COPYEDIT_IN_PROGRESS", () => {
    expect(getHandoffStatus("COPYEDIT_IN_PROGRESS")).toBe("internal");
  });

  it("returns internal for PROOFREAD", () => {
    expect(getHandoffStatus("PROOFREAD")).toBe("internal");
  });

  it("returns internal for COPYEDIT_PENDING", () => {
    expect(getHandoffStatus("COPYEDIT_PENDING")).toBe("internal");
  });
});

describe("getAgingColor", () => {
  it("returns success classes for on-track", () => {
    const color = getAgingColor("on-track");
    expect(color.text).toContain("status-success");
    expect(color.bg).toContain("status-success");
    expect(color.badge).toContain("status-success");
  });

  it("returns error classes for overdue", () => {
    const color = getAgingColor("overdue");
    expect(color.text).toContain("status-error");
  });
});

describe("getAgingLabel", () => {
  it("returns human-readable labels", () => {
    expect(getAgingLabel("on-track")).toBe("On Track");
    expect(getAgingLabel("at-risk")).toBe("At Risk");
    expect(getAgingLabel("overdue")).toBe("Overdue");
  });
});
