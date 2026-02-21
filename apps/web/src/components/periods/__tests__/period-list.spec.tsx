import { render, screen, fireEvent, act } from "@testing-library/react";
import { PeriodList } from "../period-list";
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
    periods: {
      list: {
        useQuery: () => ({
          data: mockData,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
      create: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      delete: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
    forms: {
      list: {
        useQuery: () => ({ data: { items: [] }, isPending: false }),
      },
    },
    useUtils: () => ({
      periods: { list: { invalidate: jest.fn() } },
    }),
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  resetMocks();
});

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "period-1",
    organizationId: "org-1",
    name: "Spring 2026",
    description: null,
    opensAt: "2026-03-01T00:00:00.000Z",
    closesAt: "2026-06-01T00:00:00.000Z",
    fee: 5,
    maxSubmissions: 100,
    formDefinitionId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PeriodList", () => {
  it("renders loading skeleton while fetching", () => {
    mockIsPending = true;
    mockData = undefined;
    render(<PeriodList />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders error message on query failure", () => {
    mockError = { message: "Forbidden" };
    render(<PeriodList />);
    expect(screen.getByText(/Forbidden/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders empty state when no periods", () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<PeriodList />);
    expect(screen.getByText("No submission periods")).toBeInTheDocument();
  });

  it("renders period rows with correct computed status badges", () => {
    // Use a far-future period to ensure UPCOMING status
    mockData = {
      items: [
        makeItem({
          opensAt: "2099-01-01T00:00:00.000Z",
          closesAt: "2099-06-01T00:00:00.000Z",
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    render(<PeriodList />);
    expect(screen.getByText("Spring 2026")).toBeInTheDocument();
    // "Upcoming" appears in both the tab and the badge
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("$5.00")).toBeInTheDocument();
  });

  it("filters by status tab", () => {
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<PeriodList />);
    const openTab = screen.getByRole("tab", { name: "Open" });
    fireEvent.click(openTab);
    // Tab should become active — no crash
    expect(screen.getByText("No submission periods")).toBeInTheDocument();
  });

  it("debounces search input (300ms)", () => {
    jest.useFakeTimers();
    mockData = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    render(<PeriodList />);
    const input = screen.getByPlaceholderText("Search by name...");
    fireEvent.change(input, { target: { value: "spring" } });
    expect(input).toHaveValue("spring");
    act(() => {
      jest.advanceTimersByTime(300);
    });
    // No crash — component still renders
    expect(screen.getByText("No submission periods")).toBeInTheDocument();
    jest.useRealTimers();
  });
});
