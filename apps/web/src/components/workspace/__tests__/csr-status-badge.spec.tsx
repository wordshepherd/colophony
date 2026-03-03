import { render, screen } from "@testing-library/react";
import { CsrStatusBadge } from "../csr-status-badge";
import type { CSRStatus } from "@colophony/types";

const allStatuses: CSRStatus[] = [
  "draft",
  "sent",
  "in_review",
  "hold",
  "accepted",
  "rejected",
  "withdrawn",
  "no_response",
  "revise",
  "unknown",
];

const expectedLabels: Record<CSRStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  in_review: "In Review",
  hold: "On Hold",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No Response",
  revise: "Revise",
  unknown: "Unknown",
};

describe("CsrStatusBadge", () => {
  it.each(allStatuses)("renders icon for %s status", (status) => {
    const { container } = render(<CsrStatusBadge status={status} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it.each(allStatuses)("renders correct label for %s status", (status) => {
    render(<CsrStatusBadge status={status} />);
    expect(screen.getByText(expectedLabels[status])).toBeInTheDocument();
  });
});
