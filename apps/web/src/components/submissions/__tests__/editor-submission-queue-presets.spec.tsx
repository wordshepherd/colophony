import { vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
let mockPresets: Array<{
  id: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
}>;

const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

function resetMocks() {
  mockData = {
    items: [
      {
        id: "sub-1",
        title: "My Poem",
        status: "SUBMITTED",
        submittedAt: "2026-01-15T12:00:00.000Z",
        createdAt: "2026-01-14T12:00:00.000Z",
        submitterEmail: "poet@example.com",
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };
  mockIsPending = false;
  mockError = null;
  mockPeriodsData = undefined;
  mockIsAdmin = false;
  mockPresets = [];
  mockCreateMutate.mockClear();
  mockDeleteMutate.mockClear();
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
        useQuery: () => ({
          data: mockData,
          isPending: mockIsPending,
          error: mockError,
        }),
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
        useQuery: () => ({ data: mockPresets }),
      },
      create: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (...args: unknown[]) => {
            mockCreateMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        }),
      },
      delete: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (...args: unknown[]) => {
            mockDeleteMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        }),
      },
    },
  },
}));

beforeEach(() => {
  resetMocks();
});

describe("EditorSubmissionQueue — Presets", () => {
  it("shows preset dropdown when presets exist", () => {
    mockPresets = [
      {
        id: "p-1",
        name: "My Preset",
        filters: { status: "SUBMITTED" },
        isDefault: false,
      },
    ];
    render(<EditorSubmissionQueue />);
    expect(screen.getByText("Presets")).toBeInTheDocument();
  });

  it("hides preset dropdown when no presets", () => {
    mockPresets = [];
    render(<EditorSubmissionQueue />);
    expect(screen.queryByText("Presets")).not.toBeInTheDocument();
  });

  it("opens save dialog on Save Filter click", () => {
    render(<EditorSubmissionQueue />);
    fireEvent.click(screen.getByText("Save Filter"));
    expect(screen.getByText("Save Filter Preset")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. Pending reviews"),
    ).toBeInTheDocument();
  });

  it("saves preset with current filters", () => {
    render(<EditorSubmissionQueue />);
    fireEvent.click(screen.getByText("Save Filter"));

    const input = screen.getByPlaceholderText("e.g. Pending reviews");
    fireEvent.change(input, { target: { value: "My New Preset" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My New Preset",
        filters: expect.any(Object),
      }),
    );
  });
});
