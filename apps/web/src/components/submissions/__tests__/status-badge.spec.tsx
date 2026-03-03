import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../status-badge";
import type { SubmissionStatus } from "@colophony/types";

const allStatuses: SubmissionStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "HOLD",
  "REVISE_AND_RESUBMIT",
  "WITHDRAWN",
];

const expectedLabels: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  HOLD: "On Hold",
  REVISE_AND_RESUBMIT: "Revise & Resubmit",
  WITHDRAWN: "Withdrawn",
};

describe("StatusBadge", () => {
  it.each(allStatuses)("renders icon for %s status", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it.each(allStatuses)("renders correct label for %s status", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(expectedLabels[status])).toBeInTheDocument();
  });

  it("passes className prop to Badge", () => {
    const { container } = render(
      <StatusBadge status="DRAFT" className="custom-class" />,
    );
    const badge = container.firstChild;
    expect(badge).toHaveClass("custom-class");
  });
});
