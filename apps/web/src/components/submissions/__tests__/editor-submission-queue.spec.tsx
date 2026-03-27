import { vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EditorSubmissionQueue } from "../editor-submission-queue";

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
let mockPeriodsData: { items: Array<{ id: string; name: string }> } | undefined;
let mockIsAdmin: boolean;
let mockQueryInput: Record<string, unknown> | undefined;

function resetMocks() {
  mockData = undefined;
  mockIsPending = false;
  mockError = null;
  mockPeriodsData = undefined;
  mockIsAdmin = false;
  mockQueryInput = undefined;
}

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isAdmin: mockIsAdmin,
    isEditor: true,
    currentOrg: {
      id: "org-1",
      name: "Test Org",
      roles: mockIsAdmin ? ["ADMIN"] : ["EDITOR"],
    },
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      submissions: {
        list: { invalidate: vi.fn() },
        export: { fetch: vi.fn().mockResolvedValue([]) },
      },
      queuePresets: {
        list: { invalidate: vi.fn() },
      },
    }),
    submissions: {
      list: {
        useQuery: (input: Record<string, unknown>) => {
          mockQueryInput = input;
          return {
            data: mockData,
            isPending: mockIsPending,
            error: mockError,
          };
        },
      },
      batchUpdateStatus: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      batchAssignReviewers: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    periods: {
      list: {
        useQuery: () => ({ data: mockPeriodsData }),
      },
    },
    organizations: {
      members: {
        list: {
          useQuery: () => ({ data: undefined }),
        },
      },
    },
    queuePresets: {
      list: {
        useQuery: () => ({ data: [] }),
      },
      create: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      delete: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
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

  it('renders "[Anonymous]" for null submitterEmail', () => {
    mockData = {
      items: [makeItem({ id: "sub-3", submitterEmail: null })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("[Anonymous]")).toBeInTheDocument();
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
    expect(link?.getAttribute("href")).toContain("/editor/abc123");
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
    vi.useFakeTimers();
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<EditorSubmissionQueue />);
    const input = screen.getByPlaceholderText("Search by title...");
    fireEvent.change(input, { target: { value: "poetry" } });
    expect(input).toHaveValue("poetry");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // No crash — component still renders
    expect(screen.getByText("No submissions")).toBeInTheDocument();
    vi.useRealTimers();
  });

  // --- Column sorting tests ---

  it("renders sort indicators on sortable column headers", () => {
    mockData = {
      items: [makeItem()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    // All sortable columns should have clickable buttons
    expect(screen.getByRole("button", { name: /Title/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submitter/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submitted/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status/ })).toBeInTheDocument();
  });

  it("clicking a column header updates sort parameters", () => {
    mockData = {
      items: [makeItem()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    // Default sort is createdAt desc
    expect(mockQueryInput?.sortBy).toBe("createdAt");
    expect(mockQueryInput?.sortOrder).toBe("desc");

    // Click "Title" header
    fireEvent.click(screen.getByRole("button", { name: /Title/ }));
    expect(mockQueryInput?.sortBy).toBe("title");
    expect(mockQueryInput?.sortOrder).toBe("desc");
  });

  // --- Period filter tests ---

  it("renders submission period dropdown", () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    mockPeriodsData = {
      items: [
        { id: "period-1", name: "Fall 2026" },
        { id: "period-2", name: "Spring 2027" },
      ],
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("All periods")).toBeInTheDocument();
  });

  // --- Export button tests ---

  it("shows export button for admin users", () => {
    mockIsAdmin = true;
    mockData = {
      items: [makeItem()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
  });

  it("hides export button for non-admin users", () => {
    mockIsAdmin = false;
    mockData = {
      items: [makeItem()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<EditorSubmissionQueue />);
    expect(
      screen.queryByRole("button", { name: /Export/ }),
    ).not.toBeInTheDocument();
  });
});
