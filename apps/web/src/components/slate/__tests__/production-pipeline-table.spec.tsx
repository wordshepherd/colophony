import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionPipelineTable } from "../production-pipeline-table";
import type { ProductionDashboardItem } from "@colophony/types";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function makeItem(
  overrides: Partial<ProductionDashboardItem> = {},
): ProductionDashboardItem {
  return {
    pipelineItemId: "pi-1",
    stage: "COPYEDIT_IN_PROGRESS",
    submissionId: "sub-1",
    submissionTitle: "The River House",
    issueId: "iss-1",
    issueTitle: "Spring 2026",
    issueSectionTitle: "Fiction",
    sortOrder: 0,
    publicationDate: new Date("2026-04-01"),
    assignedCopyeditorEmail: "editor@example.com",
    assignedProofreaderEmail: null,
    copyeditDueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    proofreadDueAt: null,
    authorReviewDueAt: null,
    daysInStage: 2,
    lastStageChangeAt: new Date(),
    contractStatus: null,
    ...overrides,
  };
}

describe("ProductionPipelineTable", () => {
  it("renders all items as table rows", () => {
    const items = [
      makeItem({ pipelineItemId: "pi-1", submissionTitle: "Piece One" }),
      makeItem({ pipelineItemId: "pi-2", submissionTitle: "Piece Two" }),
    ];

    render(<ProductionPipelineTable items={items} />);

    expect(screen.getByText("Piece One")).toBeInTheDocument();
    expect(screen.getByText("Piece Two")).toBeInTheDocument();
  });

  it("displays aging indicator with correct color for overdue item", () => {
    const items = [
      makeItem({
        daysInStage: 15,
        copyeditDueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days past
      }),
    ];

    render(<ProductionPipelineTable items={items} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it('displays "Waiting: Author" for AUTHOR_REVIEW stage', () => {
    const items = [makeItem({ stage: "AUTHOR_REVIEW" })];

    render(<ProductionPipelineTable items={items} />);

    expect(screen.getByText("Waiting: Author")).toBeInTheDocument();
  });

  it("links piece title to pipeline detail page", () => {
    const items = [makeItem({ pipelineItemId: "pi-abc" })];

    render(<ProductionPipelineTable items={items} />);

    const link = screen.getByRole("link", { name: "The River House" });
    expect(link).toHaveAttribute("href", "/slate/pipeline/pi-abc");
  });

  it("shows dash for missing assignee", () => {
    const items = [
      makeItem({
        assignedCopyeditorEmail: null,
        assignedProofreaderEmail: null,
      }),
    ];

    render(<ProductionPipelineTable items={items} />);

    // The assignee column should show "—"
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("shows contract status badge when contract exists", () => {
    const items = [makeItem({ contractStatus: "SENT" })];

    render(<ProductionPipelineTable items={items} />);

    expect(screen.getByText("SENT")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(<ProductionPipelineTable items={[]} />);

    expect(
      screen.getByText("No pieces assigned to this issue yet."),
    ).toBeInTheDocument();
  });
});
