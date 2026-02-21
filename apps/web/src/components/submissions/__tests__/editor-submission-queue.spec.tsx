import { render, screen, fireEvent, act } from "@testing-library/react";
import { EditorSubmissionQueue } from "../editor-submission-queue";
import "../../../../test/setup";

// --- Mutable mock state ---
let mockData:
  | {
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | undefined;
let mockIsPending: boolean;
let mockError: { message: string } | null;

function resetMocks() {
  mockData = undefined;
  mockIsPending = false;
  mockError = null;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    submissions: {
      list: {
        useQuery: () => ({
          data: mockData,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
    },
  },
}));

beforeEach(() => {
  resetMocks();
});

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    organizationId: "org-1",
    submitterId: "user-1",
    submissionPeriodId: null,
    title: "My Poem",
    content: "Some content",
    coverLetter: null,
    formDefinitionId: null,
    formData: null,
    status: "SUBMITTED",
    submittedAt: "2026-01-15T12:00:00.000Z",
    createdAt: "2026-01-14T12:00:00.000Z",
    updatedAt: "2026-01-14T12:00:00.000Z",
    submitterEmail: "poet@example.com",
    ...overrides,
  };
}

describe("EditorSubmissionQueue", () => {
  it("shows loading skeletons when isPending", () => {
    mockIsPending = true;
    mockData = undefined;
    render(<EditorSubmissionQueue />);
    // Skeletons are rendered — no table or heading "Submissions"
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows error message when query fails", () => {
    mockError = { message: "Forbidden" };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText(/Forbidden/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows empty state when no submissions", () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("No submissions")).toBeInTheDocument();
  });

  it("renders submission rows with title, email, status, date", () => {
    mockData = {
      items: [makeItem()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("My Poem")).toBeInTheDocument();
    expect(screen.getByText("poet@example.com")).toBeInTheDocument();
    // StatusBadge renders "Submitted"; also appears in tab and table header
    expect(screen.getAllByText("Submitted").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
  });

  it('renders "(Untitled)" for null title', () => {
    mockData = {
      items: [makeItem({ id: "sub-2", title: null })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("(Untitled)")).toBeInTheDocument();
  });

  it('renders "\u2014" for null submitterEmail', () => {
    mockData = {
      items: [makeItem({ id: "sub-3", submitterEmail: null })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("title link points to /editor/[id]", () => {
    mockData = {
      items: [makeItem({ id: "abc123" })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    const link = screen.getByText("My Poem").closest("a");
    expect(link).toHaveAttribute("href", "/editor/abc123");
  });

  it("shows pagination when totalPages > 1", () => {
    mockData = {
      items: [makeItem()],
      total: 60,
      page: 1,
      limit: 20,
      totalPages: 3,
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });

  it("search input debounce works without crash", () => {
    jest.useFakeTimers();
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<EditorSubmissionQueue />);
    const input = screen.getByPlaceholderText("Search by title...");
    fireEvent.change(input, { target: { value: "poetry" } });
    expect(input).toHaveValue("poetry");
    act(() => {
      jest.advanceTimersByTime(300);
    });
    // No crash — component still renders
    expect(screen.getByText("No submissions")).toBeInTheDocument();
    jest.useRealTimers();
  });
});
