import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManuscriptDetail } from "../manuscript-detail";
import "../../../../test/setup";
import { mockPush } from "../../../../test/setup";

// --- Mutable mock state ---
let mockManuscriptDetail:
  | {
      id: string;
      title: string;
      description: string | null;
      createdAt: string;
      updatedAt: string;
      versions: Array<{
        id: string;
        versionNumber: number;
        label: string | null;
        createdAt: string;
        files: Array<{
          id: string;
          filename: string;
          size: number;
          scanStatus: string;
        }>;
      }>;
    }
  | undefined;
let mockIsPending: boolean;
let mockError: { message: string } | null;
let mockRelatedSubmissions: Array<{
  id: string;
  title: string | null;
  status: string;
  versionNumber: number;
}>;

let mockDeleteMutate: jest.Mock;
let mockDeleteIsPending: boolean;
let mockCreateVersionMutateAsync: jest.Mock;
let mockCreateVersionIsPending: boolean;
let mockUpdateMutateAsync: jest.Mock;
let mockUpdateIsPending: boolean;

const mockInvalidateList = jest.fn();
const mockInvalidateGetDetail = jest.fn();
const mockInvalidateGetById = jest.fn();

function resetMocks() {
  mockManuscriptDetail = undefined;
  mockIsPending = false;
  mockError = null;
  mockRelatedSubmissions = [];
  mockDeleteMutate = jest.fn();
  mockDeleteIsPending = false;
  mockCreateVersionMutateAsync = jest.fn().mockResolvedValue({});
  mockCreateVersionIsPending = false;
  mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
  mockUpdateIsPending = false;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      manuscripts: {
        list: { invalidate: mockInvalidateList },
        getDetail: { invalidate: mockInvalidateGetDetail },
        getById: { invalidate: mockInvalidateGetById },
      },
    }),
    manuscripts: {
      getDetail: {
        useQuery: () => ({
          data: mockManuscriptDetail,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
      getRelatedSubmissions: {
        useQuery: () => ({
          data: mockRelatedSubmissions,
        }),
      },
      delete: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => ({
          mutate: (...args: unknown[]) => {
            mockDeleteMutate(...args);
            opts.onSuccess?.();
          },
          isPending: mockDeleteIsPending,
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
      createVersion: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => ({
          mutateAsync: async (...args: unknown[]) => {
            const result = await mockCreateVersionMutateAsync(...args);
            opts.onSuccess?.();
            return result;
          },
          isPending: mockCreateVersionIsPending,
        }),
      },
    },
    files: {
      getDownloadUrl: {
        useMutation: () => ({
          mutateAsync: jest
            .fn()
            .mockResolvedValue({ url: "https://example.com/file" }),
          isPending: false,
        }),
      },
    },
  },
}));

jest.mock("@/components/submissions/file-upload", () => ({
  FileUpload: (props: {
    manuscriptVersionId?: string | null;
    disabled?: boolean;
  }) => (
    <div
      data-testid="file-upload"
      data-manuscript-version-id={props.manuscriptVersionId ?? ""}
      data-disabled={String(!!props.disabled)}
    />
  ),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    get success() {
      return mockToastSuccess;
    },
    get error() {
      return mockToastError;
    },
  },
}));

function makeManuscriptDetail(
  overrides?: Partial<NonNullable<typeof mockManuscriptDetail>>,
) {
  return {
    id: "m-1",
    title: "My Poem",
    description: "A love poem",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [
      {
        id: "v-1",
        versionNumber: 1,
        label: "Initial draft",
        createdAt: new Date().toISOString(),
        files: [
          {
            id: "f-1",
            filename: "poem.docx",
            size: 12345,
            scanStatus: "CLEAN",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("ManuscriptDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  it("shows loading skeletons while fetching", () => {
    mockIsPending = true;
    render(<ManuscriptDetail manuscriptId="m-1" />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders title, description, and versions", () => {
    mockManuscriptDetail = makeManuscriptDetail();
    render(<ManuscriptDetail manuscriptId="m-1" />);

    expect(screen.getByText("My Poem")).toBeInTheDocument();
    expect(screen.getByText("A love poem")).toBeInTheDocument();
    expect(screen.getByText("Version 1")).toBeInTheDocument();
    expect(screen.getByText(/Initial draft/)).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", async () => {
    mockManuscriptDetail = makeManuscriptDetail();
    const user = userEvent.setup();
    render(<ManuscriptDetail manuscriptId="m-1" />);

    await user.click(screen.getByRole("button", { name: /Delete/ }));

    expect(screen.getByText("Delete Manuscript")).toBeInTheDocument();
    expect(
      screen.getByText(/permanently delete this manuscript/),
    ).toBeInTheDocument();
  });

  it("calls delete mutation and navigates on confirm", async () => {
    mockManuscriptDetail = makeManuscriptDetail();
    const user = userEvent.setup();
    render(<ManuscriptDetail manuscriptId="m-1" />);

    // Open delete dialog
    await user.click(screen.getByRole("button", { name: /Delete/ }));

    // Confirm delete (there are now 2 Delete buttons - the dialog one)
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const confirmButton = deleteButtons[deleteButtons.length - 1];
    await user.click(confirmButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "m-1" });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/manuscripts");
    });
  });

  it("shows new version dialog and calls createVersion", async () => {
    mockManuscriptDetail = makeManuscriptDetail();
    const user = userEvent.setup();
    render(<ManuscriptDetail manuscriptId="m-1" />);

    await user.click(screen.getByRole("button", { name: /New Version/ }));

    expect(screen.getByText("Create New Version")).toBeInTheDocument();

    const labelInput = screen.getByPlaceholderText(
      "e.g., Revised after feedback",
    );
    await user.type(labelInput, "Second draft");

    await user.click(screen.getByRole("button", { name: "Create Version" }));

    await waitFor(() => {
      expect(mockCreateVersionMutateAsync).toHaveBeenCalledWith({
        manuscriptId: "m-1",
        label: "Second draft",
      });
    });
  });

  it("shows error state when manuscript not found", () => {
    mockError = { message: "Manuscript not found" };
    render(<ManuscriptDetail manuscriptId="m-1" />);

    expect(screen.getByText("Manuscript not found.")).toBeInTheDocument();
  });
});
