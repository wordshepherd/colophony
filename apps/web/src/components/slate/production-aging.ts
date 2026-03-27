import type { PipelineStage } from "@colophony/types";

export type AgingStatus = "on-track" | "at-risk" | "overdue";

export type HandoffStatus = "internal" | "waiting-external";

interface DueDateFields {
  copyeditDueAt: Date | string | null;
  proofreadDueAt: Date | string | null;
  authorReviewDueAt: Date | string | null;
}

/** Pick the relevant due date for the item's current pipeline stage. */
export function getDeadlineForStage(
  item: { stage: PipelineStage } & DueDateFields,
): Date | string | null {
  switch (item.stage) {
    case "COPYEDIT_PENDING":
    case "COPYEDIT_IN_PROGRESS":
      return item.copyeditDueAt;
    case "AUTHOR_REVIEW":
      return item.authorReviewDueAt;
    case "PROOFREAD":
      return item.proofreadDueAt;
    default:
      return null;
  }
}

/**
 * Determine aging status based on days in stage and optional deadline.
 *
 * With deadline: green >3 days before, yellow 1-3 days, red past due.
 * Without deadline: green <5d, yellow 5-10d, red >10d.
 */
export function getAgingStatus(
  daysInStage: number,
  dueAt: Date | string | null,
): AgingStatus {
  if (dueAt) {
    const now = Date.now();
    const dueTime =
      dueAt instanceof Date ? dueAt.getTime() : new Date(dueAt).getTime();
    const daysUntilDue = Math.floor((dueTime - now) / (1000 * 60 * 60 * 24));
    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 3) return "at-risk";
    return "on-track";
  }

  if (daysInStage > 10) return "overdue";
  if (daysInStage >= 5) return "at-risk";
  return "on-track";
}

/** Tailwind classes for aging status badges and indicators. */
export function getAgingColor(status: AgingStatus): {
  text: string;
  bg: string;
  badge: string;
} {
  switch (status) {
    case "on-track":
      return {
        text: "text-green-700 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-900/30",
        badge:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      };
    case "at-risk":
      return {
        text: "text-yellow-700 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        badge:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      };
    case "overdue":
      return {
        text: "text-red-700 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-900/30",
        badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
  }
}

/** Whether the item is waiting on someone external (author) or internal. */
export function getHandoffStatus(stage: PipelineStage): HandoffStatus {
  return stage === "AUTHOR_REVIEW" ? "waiting-external" : "internal";
}

/** Human-readable aging status label. */
export function getAgingLabel(status: AgingStatus): string {
  switch (status) {
    case "on-track":
      return "On Track";
    case "at-risk":
      return "At Risk";
    case "overdue":
      return "Overdue";
  }
}
