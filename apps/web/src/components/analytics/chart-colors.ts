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

/** Hex color map for CSR (harmonized) statuses — lowercase keys */
export const CSR_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", // gray-500
  sent: "#3B82F6", // blue-500
  in_review: "#EAB308", // yellow-500
  hold: "#F97316", // orange-500
  accepted: "#22C55E", // green-500
  rejected: "#EF4444", // red-500
  withdrawn: "#A855F7", // purple-500
  no_response: "#9CA3AF", // gray-400
  revise: "#F59E0B", // amber-500
  unknown: "#D1D5DB", // gray-300
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
