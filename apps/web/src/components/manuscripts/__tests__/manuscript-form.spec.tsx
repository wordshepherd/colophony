import { vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManuscriptForm } from "../manuscript-form";
import { mockPush } from "../../../../test/setup";

// --- Mutable mock state ---
let mockExistingManuscript:
  | {
      id: string;
      title: string;
      description: string | null;
    }
  | undefined;

let mockCreateMutateAsync: Mock;
let mockCreateIsPending: boolean;

let mockUpdateMutateAsync: Mock;
let mockUpdateIsPending: boolean;

const mockInvalidateList = vi.fn();
const mockInvalidateGetById = vi.fn();
const mockInvalidateGetDetail = vi.fn();

function resetMocks() {
  mockExistingManuscript = undefined;
  mockCreateMutateAsync = vi.fn().mockResolvedValue({
    id: "new-m-1",
    title: "New Manuscript",
  });
  mockCreateIsPending = false;
  mockUpdateMutateAsync = vi.fn().mockResolvedValue({});
  mockUpdateIsPending = false;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      manuscripts: {
        list: { invalidate: mockInvalidateList },
        getById: { invalidate: mockInvalidateGetById },
        getDetail: { invalidate: mockInvalidateGetDetail },
      },
    }),
    manuscripts: {
      getById: {
        useQuery: () => ({
          data: mockExistingManuscript,
          isPending: false,
        }),
      },
      create: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => ({
          mutateAsync: async (...args: unknown[]) => {
            const result = await mockCreateMutateAsync(...args);
            opts.onSuccess?.(result);
            return result;
          },
          isPending: mockCreateIsPending,
        }),
      },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => ({
          mutateAsync: async (...args: unknown[]) => {
            const result = await mockUpdateMutateAsync(...args);
            opts.onSuccess?.();
            return result;
          },
          isPending: mockUpdateIsPending,
        }),
      },
    },
  },
}));

const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    get success() {
      return mockToastSuccess;
    },
    get error() {
      return vi.fn();
    },
  },
}));

describe("ManuscriptForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it("renders create form with empty fields", () => {
    render(<ManuscriptForm mode="create" />);

    expect(screen.getByText("New Manuscript")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter manuscript title")).toHaveValue(
      "",
    );
    expect(
      screen.getByRole("button", { name: "Create Manuscript" }),
    ).toBeInTheDocument();
  });

  it("calls create mutation with title and description", async () => {
    const user = userEvent.setup();
    render(<ManuscriptForm mode="create" />);

    await user.type(
      screen.getByPlaceholderText("Enter manuscript title"),
      "My Poem",
    );
    await user.type(
      screen.getByPlaceholderText("Optional description of your manuscript"),
      "A love poem",
    );

    await user.click(screen.getByRole("button", { name: "Create Manuscript" }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        title: "My Poem",
        description: "A love poem",
      });
    });
  });

  it("shows Title is required validation", async () => {
    const user = userEvent.setup();
    render(<ManuscriptForm mode="create" />);

    await user.click(screen.getByRole("button", { name: "Create Manuscript" }));

    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it("calls onSuccess callback instead of navigating when provided", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<ManuscriptForm mode="create" onSuccess={onSuccess} />);

    // Inline mode — uses compact layout
    await user.type(screen.getByPlaceholderText("Manuscript title"), "Test");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        id: "new-m-1",
        title: "New Manuscript",
      });
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("populates form in edit mode", () => {
    mockExistingManuscript = {
      id: "m-1",
      title: "Existing Poem",
      description: "A haiku",
    };

    render(<ManuscriptForm mode="edit" manuscriptId="m-1" />);

    expect(screen.getByText("Edit Manuscript")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter manuscript title")).toHaveValue(
      "Existing Poem",
    );
  });

  it("calls update mutation with { id, data }", async () => {
    mockExistingManuscript = {
      id: "m-1",
      title: "Old Title",
      description: null,
    };

    const user = userEvent.setup();
    render(<ManuscriptForm mode="edit" manuscriptId="m-1" />);

    const titleInput = screen.getByPlaceholderText("Enter manuscript title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "m-1",
        data: {
          title: "New Title",
          description: null,
        },
      });
    });
  });
});
