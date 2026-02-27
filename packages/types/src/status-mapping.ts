import type { CSRStatus } from "./csr";

// ---------------------------------------------------------------------------
// Hopper status type (internal submission statuses)
// ---------------------------------------------------------------------------

export type HopperStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "HOLD"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

// ---------------------------------------------------------------------------
// Hopper → CSR mapping
// ---------------------------------------------------------------------------

const HOPPER_TO_CSR: Record<HopperStatus, CSRStatus> = {
  DRAFT: "draft",
  SUBMITTED: "sent",
  UNDER_REVIEW: "in_review",
  HOLD: "hold",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
};

/**
 * Map a Hopper (internal) submission status to a CSR (cross-system) status.
 * Unknown Hopper statuses map to `"unknown"`.
 */
export function hopperToCsrStatus(hopper: string): CSRStatus {
  return HOPPER_TO_CSR[hopper as HopperStatus] ?? "unknown";
}

// ---------------------------------------------------------------------------
// CSR → Hopper reverse mapping
// ---------------------------------------------------------------------------

const CSR_TO_HOPPER: Partial<Record<CSRStatus, HopperStatus>> = {
  draft: "DRAFT",
  sent: "SUBMITTED",
  in_review: "UNDER_REVIEW",
  hold: "HOLD",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
  withdrawn: "WITHDRAWN",
};

/**
 * Reverse-map a CSR status back to a Hopper status.
 * Returns `null` for CSR statuses with no Hopper equivalent
 * (`no_response`, `revise`, `unknown`).
 */
export function csrToHopperStatus(csr: CSRStatus): HopperStatus | null {
  return CSR_TO_HOPPER[csr] ?? null;
}
