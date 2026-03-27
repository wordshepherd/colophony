import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionDashboard } from "../production-dashboard";

// Mock tRPC
const mockDashboardQuery = vi.fn();
const mockActiveIssuesQuery = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    pipeline: {
      dashboard: {
        useQuery: (...args: unknown[]) => mockDashboardQuery(...args),
      },
    },
    issues: {
      activeIssues: {
        useQuery: (...args: unknown[]) => mockActiveIssuesQuery(...args),
      },
    },
  },
}));

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

// Mock child components to isolate
vi.mock("../production-issue-selector", () => ({
  ProductionIssueSelector: ({
    onSelect,
  }: {
    selectedIssueId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <button data-testid="issue-selector" onClick={() => onSelect("iss-1")}>
      Select Issue
    </button>
  ),
}));

describe("ProductionDashboard", () => {
  it("renders empty state when no active issues (dashboard returns null)", () => {
    mockDashboardQuery.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });

    render(<ProductionDashboard />);

    expect(screen.getByText("Production")).toBeInTheDocument();
    expect(screen.getByText(/No active issues found/)).toBeInTheDocument();
  });

  it("renders stats cards and table when data present", () => {
    mockDashboardQuery.mockReturnValue({
      data: {
        issueId: "iss-1",
        issueTitle: "Spring 2026",
        issueStatus: "PLANNING",
        publicationDate: new Date("2026-04-01"),
        items: [
          {
            pipelineItemId: "pi-1",
            stage: "COPYEDIT_IN_PROGRESS",
            submissionId: "sub-1",
            submissionTitle: "Test Piece",
            issueId: "iss-1",
            issueTitle: "Spring 2026",
            issueSectionTitle: "Fiction",
            sortOrder: 0,
            publicationDate: new Date("2026-04-01"),
            assignedCopyeditorEmail: "editor@test.com",
            assignedProofreaderEmail: null,
            copyeditDueAt: new Date(Date.now() + 10 * 86400000),
            proofreadDueAt: null,
            authorReviewDueAt: null,
            daysInStage: 2,
            lastStageChangeAt: new Date(),
            contractStatus: null,
          },
        ],
        summary: {
          total: 1,
          onTrack: 1,
          atRisk: 0,
          overdue: 0,
          waiting: 0,
        },
      },
      isPending: false,
      error: null,
    });

    render(<ProductionDashboard />);

    expect(screen.getByText("Production")).toBeInTheDocument();
    expect(screen.getByText("Total Pieces")).toBeInTheDocument();
    expect(screen.getByText("Test Piece")).toBeInTheDocument();
  });

  it("shows loading skeletons when query is pending", () => {
    mockDashboardQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    });

    const { container } = render(<ProductionDashboard />);

    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
