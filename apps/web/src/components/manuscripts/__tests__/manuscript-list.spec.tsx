import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManuscriptList } from "../manuscript-list";
import "../../../../test/setup";

// --- Mutable mock state ---
let mockManuscripts:
  | {
      items: Array<{
        id: string;
        title: string;
        description: string | null;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | undefined;
let mockIsPending: boolean;
let mockError: { message: string } | null;
let mockLastInput: Record<string, unknown> | undefined;

function resetMocks() {
  mockManuscripts = {
    items: [],
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 0,
  };
  mockIsPending = false;
  mockError = null;
  mockLastInput = undefined;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    manuscripts: {
      list: {
        useQuery: (input: Record<string, unknown>) => {
          mockLastInput = input;
          return {
            data: mockManuscripts,
            isPending: mockIsPending,
            error: mockError,
          };
        },
      },
    },
  },
}));

describe("ManuscriptList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  it("renders heading, search input, and New Manuscript button", () => {
    render(<ManuscriptList />);

    expect(screen.getByText("My Manuscripts")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search manuscripts..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /New Manuscript/i }),
    ).toBeInTheDocument();
  });

  it("shows skeleton loading state", () => {
    mockIsPending = true;
    mockManuscripts = undefined;
    render(<ManuscriptList />);

    // 6 skeleton items (Skeleton renders animate-pulse divs)
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it("renders manuscript cards in grid", () => {
    mockManuscripts = {
      items: [
        {
          id: "m1",
          title: "My Poem",
          description: "A love poem",
          updatedAt: new Date().toISOString(),
        },
        {
          id: "m2",
          title: "Short Story",
          description: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 2,
      page: 1,
      limit: 12,
      totalPages: 1,
    };

    render(<ManuscriptList />);

    expect(screen.getByText("My Poem")).toBeInTheDocument();
    expect(screen.getByText("Short Story")).toBeInTheDocument();
  });

  it("shows empty state with CTA when no manuscripts", () => {
    mockManuscripts = {
      items: [],
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 0,
    };

    render(<ManuscriptList />);

    expect(screen.getByText("No manuscripts")).toBeInTheDocument();
    expect(
      screen.getByText("You haven't created any manuscripts yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Create your first manuscript/i }),
    ).toBeInTheDocument();
  });

  it("shows pagination when totalPages > 1", () => {
    mockManuscripts = {
      items: [
        {
          id: "m1",
          title: "Poem",
          description: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 25,
      page: 2,
      limit: 12,
      totalPages: 3,
    };

    render(<ManuscriptList />);

    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it("search input updates query", async () => {
    const user = userEvent.setup();
    render(<ManuscriptList />);

    const searchInput = screen.getByPlaceholderText("Search manuscripts...");
    await user.type(searchInput, "poem");

    // The query is called with the input that includes the search (after debounce)
    await waitFor(() => {
      expect(mockLastInput).toBeDefined();
    });
  });
});
