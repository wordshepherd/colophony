import { vi, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchActionBar } from "../batch-action-bar";

// --- Mutable mock state ---
let mockMutate: Mock;
let mockAssignMutate: Mock;
let mockIsPending: boolean;
let mockAssignIsPending: boolean;
let mockMembersData:
  | { items: Array<{ userId: string; email: string; role: string }> }
  | undefined;

function resetMocks() {
  mockMutate = vi.fn();
  mockAssignMutate = vi.fn();
  mockIsPending = false;
  mockAssignIsPending = false;
  mockMembersData = undefined;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    submissions: {
      batchUpdateStatus: {
        useMutation: () => ({
          mutate: mockMutate,
          isPending: mockIsPending,
        }),
      },
      batchAssignReviewers: {
        useMutation: () => ({
          mutate: mockAssignMutate,
          isPending: mockAssignIsPending,
        }),
      },
      list: {
        invalidate: vi.fn(),
      },
    },
    organizations: {
      members: {
        list: {
          useQuery: () => ({
            data: mockMembersData,
          }),
        },
      },
    },
    useUtils: () => ({
      submissions: {
        list: { invalidate: vi.fn() },
      },
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  resetMocks();
});

const defaultProps = {
  selectedCount: 3,
  selectedIds: ["id-1", "id-2", "id-3"],
  statusFilter: "SUBMITTED" as const,
  onClear: vi.fn(),
  onSuccess: vi.fn(),
};

describe("BatchActionBar", () => {
  it("hides when selectedCount is 0", () => {
    const { container } = render(
      <BatchActionBar {...defaultProps} selectedCount={0} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows count and Clear button", () => {
    render(<BatchActionBar {...defaultProps} />);
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("shows context-appropriate status buttons for SUBMITTED filter", () => {
    render(<BatchActionBar {...defaultProps} />);
    expect(screen.getByText("Move to Review")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows confirmation dialog for Reject (destructive action)", () => {
    render(<BatchActionBar {...defaultProps} />);

    // Click Reject — should open confirmation dialog, not fire mutation
    fireEvent.click(screen.getByText("Reject"));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/This action will reject 3 submissions/i),
    ).toBeInTheDocument();
  });

  it("fires mutation after confirming destructive action", () => {
    render(<BatchActionBar {...defaultProps} />);

    fireEvent.click(screen.getByText("Reject"));
    fireEvent.click(screen.getByText("Confirm"));

    expect(mockMutate).toHaveBeenCalledWith({
      submissionIds: ["id-1", "id-2", "id-3"],
      status: "REJECTED",
    });
  });

  it("does NOT show confirmation for non-destructive actions", () => {
    render(<BatchActionBar {...defaultProps} />);

    fireEvent.click(screen.getByText("Move to Review"));

    // Mutation fires immediately, no dialog
    expect(mockMutate).toHaveBeenCalledWith({
      submissionIds: ["id-1", "id-2", "id-3"],
      status: "UNDER_REVIEW",
    });
    expect(screen.queryByText(/This cannot be undone/)).not.toBeInTheDocument();
  });

  it("opens assign reviewers dialog", () => {
    render(<BatchActionBar {...defaultProps} />);

    fireEvent.click(screen.getByText("Assign Reviewers"));

    expect(screen.getByText(/Select reviewers to assign/)).toBeInTheDocument();
  });

  it("disables buttons while mutation is pending", () => {
    mockIsPending = true;
    render(<BatchActionBar {...defaultProps} />);

    expect(screen.getByText("Move to Review")).toBeDisabled();
    expect(screen.getByText("Reject")).toBeDisabled();
    expect(screen.getByText("Assign Reviewers")).toBeDisabled();
  });
});
