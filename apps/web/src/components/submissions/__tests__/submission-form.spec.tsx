import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionForm } from "../submission-form";
import { mockPush, mockBack } from "../../../../test/setup";

// --- Mutable mock state ---
let mockExistingSubmission: Record<string, unknown> | undefined;
let mockIsLoadingSubmission: boolean;
let mockExistingFiles: Array<Record<string, unknown>> | undefined;

let mockCreateMutateAsync: jest.Mock;
let mockCreateIsPending: boolean;
let mockCreateOnSuccess: ((data: { id: string }) => void) | undefined;
let mockCreateOnError: ((err: { message: string }) => void) | undefined;

let mockUpdateMutateAsync: jest.Mock;
let mockUpdateIsPending: boolean;
let mockUpdateOnSuccess: (() => void) | undefined;
let mockUpdateOnError: ((err: { message: string }) => void) | undefined;

let mockSubmitMutateAsync: jest.Mock;
let mockSubmitIsPending: boolean;
let mockSubmitOnSuccess: (() => void) | undefined;
let mockSubmitOnError: ((err: { message: string }) => void) | undefined;

const mockInvalidateGetById = jest.fn();

function resetMocks() {
  mockExistingSubmission = undefined;
  mockIsLoadingSubmission = false;
  mockExistingFiles = undefined;

  mockCreateMutateAsync = jest.fn().mockResolvedValue({ id: "new-sub-1" });
  mockCreateIsPending = false;
  mockCreateOnSuccess = undefined;
  mockCreateOnError = undefined;

  mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
  mockUpdateIsPending = false;
  mockUpdateOnSuccess = undefined;
  mockUpdateOnError = undefined;

  mockSubmitMutateAsync = jest.fn().mockResolvedValue({});
  mockSubmitIsPending = false;
  mockSubmitOnSuccess = undefined;
  mockSubmitOnError = undefined;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      submissions: { getById: { invalidate: mockInvalidateGetById } },
    }),
    submissions: {
      getById: {
        useQuery: (_input: unknown, _opts?: Record<string, unknown>) => ({
          data: mockExistingSubmission,
          isPending: mockIsLoadingSubmission,
        }),
      },
      create: {
        useMutation: (opts: Record<string, Function>) => {
          mockCreateOnSuccess = opts.onSuccess as typeof mockCreateOnSuccess;
          mockCreateOnError = opts.onError as typeof mockCreateOnError;
          return {
            mutateAsync: mockCreateMutateAsync,
            isPending: mockCreateIsPending,
          };
        },
      },
      update: {
        useMutation: (opts: Record<string, Function>) => {
          mockUpdateOnSuccess = opts.onSuccess as typeof mockUpdateOnSuccess;
          mockUpdateOnError = opts.onError as typeof mockUpdateOnError;
          return {
            mutateAsync: mockUpdateMutateAsync,
            isPending: mockUpdateIsPending,
          };
        },
      },
      submit: {
        useMutation: (opts: Record<string, Function>) => {
          mockSubmitOnSuccess = opts.onSuccess as typeof mockSubmitOnSuccess;
          mockSubmitOnError = opts.onError as typeof mockSubmitOnError;
          return {
            mutateAsync: mockSubmitMutateAsync,
            isPending: mockSubmitIsPending,
          };
        },
      },
    },
    files: {
      listBySubmission: {
        useQuery: () => ({
          data: mockExistingFiles,
        }),
      },
    },
  },
}));

jest.mock("../file-upload", () => ({
  FileUpload: (props: { submissionId: string; disabled: boolean }) => (
    <div
      data-testid="file-upload"
      data-submission-id={props.submissionId}
      data-disabled={String(props.disabled)}
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

// --- Fixtures ---
function makeDraftSubmission(overrides?: Record<string, unknown>) {
  return {
    id: "sub-1",
    title: "My Poem",
    content: "Roses are red...",
    coverLetter: "Dear editors,",
    status: "DRAFT",
    ...overrides,
  };
}

describe("SubmissionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  // --- Create mode ---
  describe("create mode", () => {
    it("renders New Submission heading, empty fields, Create Draft button, no FileUpload", () => {
      render(<SubmissionForm mode="create" />);

      expect(screen.getByText("New Submission")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter submission title")).toHaveValue(
        "",
      );
      expect(
        screen.getByPlaceholderText(
          "Enter your submission content (optional if uploading files)",
        ),
      ).toHaveValue("");
      expect(
        screen.getByPlaceholderText(
          "Optional cover letter or notes for the editors",
        ),
      ).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "Create Draft" }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("file-upload")).not.toBeInTheDocument();
    });

    it("calls createMutation.mutateAsync with form data on submit", async () => {
      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      await user.type(
        screen.getByPlaceholderText("Enter submission title"),
        "My Story",
      );
      await user.type(
        screen.getByPlaceholderText(
          "Enter your submission content (optional if uploading files)",
        ),
        "Once upon a time",
      );
      await user.type(
        screen.getByPlaceholderText(
          "Optional cover letter or notes for the editors",
        ),
        "Please consider",
      );

      await user.click(screen.getByRole("button", { name: "Create Draft" }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith({
          title: "My Story",
          content: "Once upon a time",
          coverLetter: "Please consider",
        });
      });
    });

    it("shows Title is required validation when title empty", async () => {
      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      await user.click(screen.getByRole("button", { name: "Create Draft" }));

      await waitFor(() => {
        expect(screen.getByText("Title is required")).toBeInTheDocument();
      });
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it("shows error alert when create mutation rejects", async () => {
      // In real tRPC, mutateAsync rejects AND onError fires. The component's
      // onSubmit awaits mutateAsync without try/catch, so the rejection bubbles
      // up to react-hook-form which catches it. Meanwhile onError sets error state.
      // We simulate by: resolving mutateAsync (so no unhandled rejection), but
      // firing onError to trigger setError.
      mockCreateMutateAsync.mockImplementationOnce(async () => {
        // Fire the onError callback as tRPC would
        mockCreateOnError?.({ message: "Server error" });
        return { id: "irrelevant" };
      });
      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      await user.type(
        screen.getByPlaceholderText("Enter submission title"),
        "Test",
      );
      await user.click(screen.getByRole("button", { name: "Create Draft" }));

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });
  });

  // --- Edit mode — DRAFT ---
  describe("edit mode — DRAFT", () => {
    it("shows loading spinner when isLoadingSubmission is true", () => {
      mockIsLoadingSubmission = true;
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      // Loader2 renders as an SVG with animate-spin class
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Enter submission title"),
      ).not.toBeInTheDocument();
    });

    it("populates form with existing submission data", () => {
      mockExistingSubmission = makeDraftSubmission();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      expect(screen.getByText("Edit Submission")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter submission title")).toHaveValue(
        "My Poem",
      );
      expect(
        screen.getByPlaceholderText(
          "Enter your submission content (optional if uploading files)",
        ),
      ).toHaveValue("Roses are red...");
      expect(
        screen.getByPlaceholderText(
          "Optional cover letter or notes for the editors",
        ),
      ).toHaveValue("Dear editors,");
    });

    it("renders FileUpload with correct submissionId and disabled=false", () => {
      mockExistingSubmission = makeDraftSubmission();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      const fileUpload = screen.getByTestId("file-upload");
      expect(fileUpload).toBeInTheDocument();
      expect(fileUpload).toHaveAttribute("data-submission-id", "sub-1");
      expect(fileUpload).toHaveAttribute("data-disabled", "false");
    });

    it("calls updateMutation.mutateAsync with { id, ...data } on Save Draft", async () => {
      mockExistingSubmission = makeDraftSubmission();
      const user = userEvent.setup();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      // Modify title
      const titleInput = screen.getByPlaceholderText("Enter submission title");
      await user.clear(titleInput);
      await user.type(titleInput, "Updated Poem");

      await user.click(screen.getByRole("button", { name: "Save Draft" }));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          id: "sub-1",
          title: "Updated Poem",
          content: "Roses are red...",
          coverLetter: "Dear editors,",
        });
      });
    });
  });

  // --- Edit mode — non-DRAFT ---
  describe("edit mode — non-DRAFT", () => {
    it("shows 'cannot be edited' alert, no form fields", () => {
      mockExistingSubmission = makeDraftSubmission({ status: "SUBMITTED" });
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      expect(screen.getByText(/cannot be edited/i)).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Enter submission title"),
      ).not.toBeInTheDocument();
    });
  });

  // --- Submit for Review ---
  describe("submit for review", () => {
    it("calls update then submit when all files CLEAN", async () => {
      mockExistingSubmission = makeDraftSubmission();
      mockExistingFiles = [
        { id: "f1", scanStatus: "CLEAN" },
        { id: "f2", scanStatus: "CLEAN" },
      ];
      const user = userEvent.setup();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      await user.click(
        screen.getByRole("button", { name: "Submit for Review" }),
      );

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ id: "sub-1" }),
        );
      });

      await waitFor(() => {
        expect(mockSubmitMutateAsync).toHaveBeenCalledWith({ id: "sub-1" });
      });
    });

    it("blocks with toast.error when files SCANNING/PENDING", async () => {
      mockExistingSubmission = makeDraftSubmission();
      mockExistingFiles = [
        { id: "f1", scanStatus: "CLEAN" },
        { id: "f2", scanStatus: "SCANNING" },
      ];
      const user = userEvent.setup();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      await user.click(
        screen.getByRole("button", { name: "Submit for Review" }),
      );

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Please wait for file scans to complete",
        );
      });
      expect(mockSubmitMutateAsync).not.toHaveBeenCalled();
    });

    it("blocks with toast.error when files INFECTED", async () => {
      mockExistingSubmission = makeDraftSubmission();
      mockExistingFiles = [
        { id: "f1", scanStatus: "CLEAN" },
        { id: "f2", scanStatus: "INFECTED" },
      ];
      const user = userEvent.setup();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      await user.click(
        screen.getByRole("button", { name: "Submit for Review" }),
      );

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Please remove infected files before submitting",
        );
      });
      expect(mockSubmitMutateAsync).not.toHaveBeenCalled();
    });

    it("shows both Save Draft and Submit for Review buttons in edit mode", () => {
      mockExistingSubmission = makeDraftSubmission();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      expect(
        screen.getByRole("button", { name: "Save Draft" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Submit for Review" }),
      ).toBeInTheDocument();
    });
  });
});
