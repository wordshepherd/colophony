/** Hex color map for submission statuses — matches Tailwind classes in status-badge.tsx */
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6B7280", // gray-500
  SUBMITTED: "#3B82F6", // blue-500
  UNDER_REVIEW: "#EAB308", // yellow-500
  ACCEPTED: "#22C55E", // green-500
  REJECTED: "#EF4444", // red-500
  HOLD: "#F97316", // orange-500
  REVISE_AND_RESUBMIT: "#F59E0B", // amber-500
  WITHDRAWN: "#A855F7", // purple-500
};

export const CHART_COLORS = [
  "#3B82F6",
  "#22C55E",
  "#EF4444",
  "#EAB308",
  "#F97316",
  "#A855F7",
  "#6B7280",
] as const;
