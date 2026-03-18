import { vi, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionForm } from "../submission-form";
// Navigation mocks imported to ensure setup.ts runs (registers next/navigation mock)

// Mock shadcn Select with native HTML elements (Radix Select doesn't work in jsdom)
vi.mock("@/components/ui/select", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const SelectContext = React.createContext({
    onValueChange: (_v: string) => {},
    value: undefined as string | undefined,
  });
  return {
    Select: ({
      children,
      onValueChange,
      value,
    }: {
      children: React.ReactNode;
      onValueChange: (v: string) => void;
      value?: string;
    }) => (
      <SelectContext.Provider value={{ onValueChange, value }}>
        <div data-testid="mock-select" data-value={value}>
          {children}
        </div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
      <button
        type="button"
        role="combobox"
        aria-expanded="false"
        aria-controls="mock-listbox"
      >
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <span>{placeholder}</span>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div role="listbox">{children}</div>
    ),
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => {
      const ctx = React.useContext(SelectContext);
      return (
        <div
          role="option"
          aria-selected={ctx.value === value}
          data-value={value}
          onClick={() => ctx.onValueChange(value)}
        >
          {children}
        </div>
      );
    },
  };
});

// --- Mutable mock state ---
let mockExistingSubmission: Record<string, unknown> | undefined;
let mockIsLoadingSubmission: boolean;
let mockExistingFiles: Array<Record<string, unknown>> | undefined;
let mockFormDefinition: Record<string, unknown> | undefined;
let mockPublishedForms: {
  items: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

let mockCreateMutateAsync: Mock;
let mockCreateIsPending: boolean;
let mockCreateOnError: ((err: { message: string }) => void) | undefined;

let mockUpdateMutateAsync: Mock;
let mockUpdateIsPending: boolean;

let mockSubmitMutateAsync: Mock;
let mockSubmitIsPending: boolean;
let mockSubmitOnError:
  | ((err: { message: string; data?: unknown }) => void)
  | undefined;

const mockInvalidateGetById = vi.fn();

function resetMocks() {
  mockExistingSubmission = undefined;
  mockIsLoadingSubmission = false;
  mockExistingFiles = undefined;
  mockFormDefinition = undefined;
  mockManuscriptPickerOnChange = undefined;
  mockPublishedForms = {
    items: [],
    total: 0,
    page: 1,
    limit: 100,
    totalPages: 0,
  };

  mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: "new-sub-1" });
  mockCreateIsPending = false;
  mockCreateOnError = undefined;

  mockUpdateMutateAsync = vi.fn().mockResolvedValue({});
  mockUpdateIsPending = false;

  mockSubmitMutateAsync = vi.fn().mockResolvedValue({});
  mockSubmitIsPending = false;
  mockSubmitOnError = undefined;
}

vi.mock("@/lib/trpc", () => ({
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
      listByManuscriptVersion: {
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
      list: {
        useQuery: () => ({
          data: mockPublishedForms,
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("../file-upload", () => ({
  FileUpload: (props: {
    manuscriptVersionId?: string | null;
    disabled: boolean;
  }) => (
    <div
      data-testid="file-upload"
      data-manuscript-version-id={props.manuscriptVersionId ?? ""}
      data-disabled={String(props.disabled)}
    />
  ),
}));

let mockManuscriptPickerOnChange:
  | ((versionId: string | null) => void)
  | undefined;
vi.mock("@/components/manuscripts/manuscript-picker", () => ({
  ManuscriptPicker: (props: {
    value: string | null;
    onChange: (versionId: string | null) => void;
    disabled?: boolean;
  }) => {
    mockManuscriptPickerOnChange = props.onChange;
    return (
      <div
        data-testid="manuscript-picker"
        data-value={props.value ?? ""}
        data-disabled={String(!!props.disabled)}
      />
    );
  },
}));

vi.mock("../form-renderer", async () => {
  const actual = await vi.importActual("../form-renderer");
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

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
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
    vi.clearAllMocks();
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
          formData: undefined,
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

    it("renders FileUpload with manuscriptVersionId and disabled=false", () => {
      mockExistingSubmission = makeDraftSubmission({
        manuscriptVersionId: "mv-1",
      });
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      const fileUpload = screen.getByTestId("file-upload");
      expect(fileUpload).toBeInTheDocument();
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
        formDefinitionId: "00000000-0000-4000-8000-000000000001",
      });
      mockFormDefinition = {
        id: "00000000-0000-4000-8000-000000000001",
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
        "00000000-0000-4000-8000-000000000001",
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
        formDefinitionId: "00000000-0000-4000-8000-000000000001",
        formData: { bio: "A poet" },
      });
      mockFormDefinition = {
        id: "00000000-0000-4000-8000-000000000001",
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
        formDefinitionId: "00000000-0000-4000-8000-000000000001",
      });
      mockFormDefinition = {
        id: "00000000-0000-4000-8000-000000000001",
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

  // --- Form selector (create mode) ---
  describe("form selector", () => {
    it("renders form selector card with published forms in create mode", () => {
      mockPublishedForms = {
        items: [
          { id: "form-1", name: "Poetry Form" },
          { id: "form-2", name: "Fiction Form" },
        ],
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      };

      render(<SubmissionForm mode="create" />);

      // Card title renders
      expect(screen.getByText("Submission Form")).toBeInTheDocument();
      // Options are rendered (mock Select renders them directly)
      expect(screen.getByText("Poetry Form")).toBeInTheDocument();
      expect(screen.getByText("Fiction Form")).toBeInTheDocument();
      // None option rendered
      expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
    });

    it("does not render form selector in edit mode", () => {
      mockExistingSubmission = makeDraftSubmission();

      render(<SubmissionForm mode="edit" submissionId="sub-1" />);

      expect(screen.queryByText("Submission Form")).not.toBeInTheDocument();
    });

    it("shows DynamicFormFields when a form is selected in create mode", async () => {
      mockPublishedForms = {
        items: [
          { id: "00000000-0000-4000-8000-000000000001", name: "Poetry Form" },
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      };
      mockFormDefinition = {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Poetry Form",
        description: null,
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

      render(<SubmissionForm mode="create" />);

      // Click the form option (mock Select calls onValueChange directly)
      fireEvent.click(screen.getByRole("option", { name: "Poetry Form" }));

      await waitFor(() => {
        const dynamicFields = screen.getByTestId("dynamic-form-fields");
        expect(dynamicFields).toBeInTheDocument();
        expect(dynamicFields).toHaveAttribute(
          "data-form-definition-id",
          "00000000-0000-4000-8000-000000000001",
        );
      });
    });

    it("includes formDefinitionId in create mutation when form selected", async () => {
      mockPublishedForms = {
        items: [
          { id: "00000000-0000-4000-8000-000000000001", name: "Poetry Form" },
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      };
      mockFormDefinition = {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Poetry Form",
        description: null,
        fields: [],
      };

      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      // Select the form option
      fireEvent.click(screen.getByRole("option", { name: "Poetry Form" }));

      // Fill title
      await user.type(
        screen.getByPlaceholderText("Enter submission title"),
        "My Poem",
      );

      await user.click(screen.getByRole("button", { name: "Create Draft" }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "My Poem",
            formDefinitionId: "00000000-0000-4000-8000-000000000001",
          }),
        );
      });
    });

    it("renders manuscript picker in create mode", () => {
      render(<SubmissionForm mode="create" />);
      expect(screen.getByTestId("manuscript-picker")).toBeInTheDocument();
    });

    it("passes manuscriptVersionId to create mutation", async () => {
      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      // Simulate selecting a manuscript via the picker callback
      mockManuscriptPickerOnChange?.("mv-123");

      await user.type(
        screen.getByPlaceholderText("Enter submission title"),
        "My Story",
      );
      await user.click(screen.getByRole("button", { name: "Create Draft" }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "My Story",
            manuscriptVersionId: "mv-123",
          }),
        );
      });
    });

    it("omits formDefinitionId when no form selected", async () => {
      mockPublishedForms = {
        items: [
          { id: "00000000-0000-4000-8000-000000000001", name: "Poetry Form" },
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      };

      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      // Fill title without selecting a form
      await user.type(
        screen.getByPlaceholderText("Enter submission title"),
        "My Story",
      );

      await user.click(screen.getByRole("button", { name: "Create Draft" }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalled();
        const callArgs = mockCreateMutateAsync.mock.calls[0][0];
        expect(callArgs.title).toBe("My Story");
        expect(callArgs).not.toHaveProperty("formDefinitionId");
      });
    });
  });
});
