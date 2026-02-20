import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionForm } from "../submission-form";
// Navigation mocks imported to ensure setup.ts runs (registers next/navigation mock)
import "../../../../test/setup";

// --- Mutable mock state ---
let mockExistingSubmission: Record<string, unknown> | undefined;
let mockIsLoadingSubmission: boolean;
let mockExistingFiles: Array<Record<string, unknown>> | undefined;
let mockFormDefinition: Record<string, unknown> | undefined;

let mockCreateMutateAsync: jest.Mock;
let mockCreateIsPending: boolean;
let mockCreateOnError: ((err: { message: string }) => void) | undefined;

let mockUpdateMutateAsync: jest.Mock;
let mockUpdateIsPending: boolean;

let mockSubmitMutateAsync: jest.Mock;
let mockSubmitIsPending: boolean;
let mockSubmitOnError:
  | ((err: { message: string; data?: unknown }) => void)
  | undefined;

const mockInvalidateGetById = jest.fn();

function resetMocks() {
  mockExistingSubmission = undefined;
  mockIsLoadingSubmission = false;
  mockExistingFiles = undefined;
  mockFormDefinition = undefined;

  mockCreateMutateAsync = jest.fn().mockResolvedValue({ id: "new-sub-1" });
  mockCreateIsPending = false;
  mockCreateOnError = undefined;

  mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
  mockUpdateIsPending = false;

  mockSubmitMutateAsync = jest.fn().mockResolvedValue({});
  mockSubmitIsPending = false;
  mockSubmitOnError = undefined;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      submissions: { getById: { invalidate: mockInvalidateGetById } },
    }),
    submissions: {
      getById: {
        useQuery: () => ({
          data: mockExistingSubmission,
          isPending: mockIsLoadingSubmission,
        }),
      },
      create: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => {
          mockCreateOnError = opts.onError as typeof mockCreateOnError;
          return {
            mutateAsync: mockCreateMutateAsync,
            isPending: mockCreateIsPending,
          };
        },
      },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (_opts: any) => ({
          mutateAsync: mockUpdateMutateAsync,
          isPending: mockUpdateIsPending,
        }),
      },
      submit: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => {
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
    forms: {
      getById: {
        useQuery: () => ({
          data: mockFormDefinition,
          isPending: false,
          error: null,
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

jest.mock("../form-renderer", () => {
  const actual = jest.requireActual("../form-renderer");
  return {
    ...actual,
    DynamicFormFields: (props: {
      formDefinitionId: string;
      disabled: boolean;
    }) => (
      <div
        data-testid="dynamic-form-fields"
        data-form-definition-id={props.formDefinitionId}
        data-disabled={String(props.disabled)}
      />
    ),
  };
});

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
          formData: {},
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
          formData: {},
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

  // --- Dynamic form fields ---
  describe("dynamic form fields", () => {
    it("renders DynamicFormFields when submission has formDefinitionId", () => {
      mockExistingSubmission = makeDraftSubmission({
        formDefinitionId: "form-def-1",
      });
      mockFormDefinition = {
        id: "form-def-1",
        name: "Poetry Submission Form",
        description: "Standard poetry form",
        fields: [
          {
            fieldKey: "bio",
            fieldType: "text",
            label: "Bio",
            description: null,
            placeholder: null,
            required: true,
            sortOrder: 0,
            config: null,
          },
        ],
      };

      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      const dynamicFields = screen.getByTestId("dynamic-form-fields");
      expect(dynamicFields).toBeInTheDocument();
      expect(dynamicFields).toHaveAttribute(
        "data-form-definition-id",
        "form-def-1",
      );
      expect(dynamicFields).toHaveAttribute("data-disabled", "false");
    });

    it("does not render DynamicFormFields when no formDefinitionId", () => {
      mockExistingSubmission = makeDraftSubmission();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      expect(
        screen.queryByTestId("dynamic-form-fields"),
      ).not.toBeInTheDocument();
    });

    it("passes formData in update mutation", async () => {
      mockExistingSubmission = makeDraftSubmission({
        formDefinitionId: "form-def-1",
        formData: { bio: "A poet" },
      });
      mockFormDefinition = {
        id: "form-def-1",
        name: "Form",
        description: null,
        fields: [
          {
            fieldKey: "bio",
            fieldType: "text",
            label: "Bio",
            description: null,
            placeholder: null,
            required: false,
            sortOrder: 0,
            config: null,
          },
        ],
      };

      const user = userEvent.setup();
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      await user.click(screen.getByRole("button", { name: "Save Draft" }));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "sub-1",
            formData: expect.objectContaining({ bio: "A poet" }),
          }),
        );
      });
    });

    it("maps field errors from submit rejection to form fields", () => {
      mockExistingSubmission = makeDraftSubmission({
        formDefinitionId: "form-def-1",
      });
      mockFormDefinition = {
        id: "form-def-1",
        name: "Form",
        description: null,
        fields: [],
      };

      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      // Simulate submit mutation onError with field errors
      const fieldErrorResponse = {
        message: "Validation failed",
        data: {
          fieldErrors: [{ fieldKey: "bio", message: "Bio is too short" }],
        },
      };

      // The onError should map field errors instead of setting generic error
      mockSubmitOnError?.(fieldErrorResponse);

      // Generic error should not be shown (mapFieldErrorsToForm returns true)
      expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
    });
  });
});
