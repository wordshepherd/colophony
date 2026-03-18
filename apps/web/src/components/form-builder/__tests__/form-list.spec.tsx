import { vi, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormList } from "../form-list";

// --- Mutable mock state ---
let mockListData:
  | {
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | undefined;
let mockIsLoading: boolean;
let mockError: { message: string } | null;
let mockPublishMutate: Mock;
let mockArchiveMutate: Mock;
let mockDuplicateMutate: Mock;
let mockDeleteMutate: Mock;

function resetMocks() {
  mockIsLoading = false;
  mockError = null;
  mockListData = undefined;
  mockPublishMutate = vi.fn();
  mockArchiveMutate = vi.fn();
  mockDuplicateMutate = vi.fn();
  mockDeleteMutate = vi.fn();
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      forms: { list: { invalidate: vi.fn() } },
    }),
    forms: {
      list: {
        useQuery: () => ({
          data: mockListData,
          isPending: mockIsLoading,
          error: mockError,
        }),
      },
      publish: {
        useMutation: () => ({
          mutate: mockPublishMutate,
          isPending: false,
        }),
      },
      archive: {
        useMutation: () => ({
          mutate: mockArchiveMutate,
          isPending: false,
        }),
      },
      duplicate: {
        useMutation: () => ({
          mutate: mockDuplicateMutate,
          isPending: false,
        }),
      },
      delete: {
        useMutation: () => ({
          mutate: mockDeleteMutate,
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const sampleForm = {
  id: "form-1",
  name: "Poetry Submission",
  description: "Submit your poems",
  status: "DRAFT",
  version: 1,
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-16T00:00:00Z",
};

describe("FormList", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("renders loading skeletons when loading", () => {
    mockIsLoading = true;
    render(<FormList />);
    // Skeletons are rendered — no form cards visible
    expect(screen.queryByText("Poetry Submission")).not.toBeInTheDocument();
    expect(screen.getByText("Forms")).toBeInTheDocument();
  });

  it("renders empty state when no forms", () => {
    mockListData = { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };
    render(<FormList />);
    expect(screen.getByText("No forms")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create your first form to start collecting submissions.",
      ),
    ).toBeInTheDocument();
  });

  it("renders form cards when data is present", () => {
    mockListData = {
      items: [sampleForm],
      total: 1,
      page: 1,
      limit: 12,
      totalPages: 1,
    };
    render(<FormList />);
    expect(screen.getByText("Poetry Submission")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockError = { message: "Network error" };
    render(<FormList />);
    expect(
      screen.getByText("Failed to load forms: Network error"),
    ).toBeInTheDocument();
  });

  it("renders status filter tabs", () => {
    mockListData = { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };
    render(<FormList />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Drafts")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("renders search input", () => {
    mockListData = { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };
    render(<FormList />);
    expect(screen.getByPlaceholderText("Search forms...")).toBeInTheDocument();
  });

  it("renders new form button linking to create page", () => {
    mockListData = { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };
    render(<FormList />);
    const newButton = screen.getByText("New Form");
    expect(newButton.closest("a")).toHaveAttribute("href", "/editor/forms/new");
  });

  it("renders pagination when multiple pages", () => {
    mockListData = {
      items: [sampleForm],
      total: 25,
      page: 1,
      limit: 12,
      totalPages: 3,
    };
    render(<FormList />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });
});
