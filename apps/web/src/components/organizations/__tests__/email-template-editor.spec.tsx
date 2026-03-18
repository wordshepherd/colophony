import { vi, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailTemplateEditor } from "../email-template-editor";

// --- Mutable mock state ---
let mockUpsertMutate: Mock;
let mockUpsertIsPending: boolean;
let mockDeleteMutate: Mock;
let mockDeleteIsPending: boolean;
let mockPreviewMutate: Mock;
let mockPreviewIsPending: boolean;
let mockExistingData: Record<string, unknown> | null;
let mockInsertContent: Mock;

function resetMocks() {
  mockUpsertMutate = vi.fn();
  mockUpsertIsPending = false;
  mockDeleteMutate = vi.fn();
  mockDeleteIsPending = false;
  mockPreviewMutate = vi.fn();
  mockPreviewIsPending = false;
  mockExistingData = null;
  mockInsertContent = vi.fn();
}

vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    getHTML: () => "<p>Test body</p>",
    commands: {
      clearContent: vi.fn(),
      setContent: vi.fn(),
    },
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        setLink: () => ({ run: vi.fn() }),
        unsetLink: () => ({ run: vi.fn() }),
        insertContent: () => ({ run: mockInsertContent }),
      }),
    }),
    isActive: () => false,
  }),
  EditorContent: ({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="editor-content">Editor</div> : null,
}));

vi.mock("@tiptap/starter-kit", () => ({
  __esModule: true,
  default: {},
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-link", () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockInvalidateList = vi.fn();
const mockInvalidateGetByName = vi.fn();

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({ isAdmin: true }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    emailTemplates: {
      getByName: {
        useQuery: () => ({
          data: mockExistingData,
          isPending: false,
        }),
      },
      upsert: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: { message: string }) => void;
        }) => ({
          mutate: (...args: unknown[]) => {
            mockUpsertMutate(...args);
            if (!mockUpsertIsPending) opts.onSuccess?.();
          },
          isPending: mockUpsertIsPending,
        }),
      },
      delete: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: { message: string }) => void;
        }) => ({
          mutate: (...args: unknown[]) => {
            mockDeleteMutate(...args);
            if (!mockDeleteIsPending) opts.onSuccess?.();
          },
          isPending: mockDeleteIsPending,
        }),
      },
      preview: {
        useMutation: (opts: {
          onSuccess?: (data: { html: string }) => void;
          onError?: (err: { message: string }) => void;
        }) => ({
          mutate: (...args: unknown[]) => {
            mockPreviewMutate(...args);
            opts.onSuccess?.({ html: "<html>preview</html>" });
          },
          isPending: mockPreviewIsPending,
        }),
      },
    },
    useUtils: () => ({
      emailTemplates: {
        list: { invalidate: mockInvalidateList },
        getByName: { invalidate: mockInvalidateGetByName },
      },
    }),
  },
}));

beforeEach(() => {
  resetMocks();
});

describe("EmailTemplateEditor", () => {
  const defaultProps = {
    templateName: "submission-received",
    mergeFields: ["submissionTitle", "submitterName", "orgName"],
    onClose: vi.fn(),
  };

  it("renders subject input and body editor", () => {
    render(<EmailTemplateEditor {...defaultProps} />);
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("save button calls upsert mutation", () => {
    render(<EmailTemplateEditor {...defaultProps} />);
    const subjectInput = screen.getByLabelText("Subject");
    fireEvent.change(subjectInput, {
      target: { value: "New: {{submissionTitle}}" },
    });
    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);
    expect(mockUpsertMutate).toHaveBeenCalled();
  });

  it("reset to default shows confirmation dialog", () => {
    mockExistingData = {
      id: "t1",
      templateName: "submission-received",
      subjectTemplate: "Old Subject",
      bodyHtml: "<p>Old Body</p>",
    };
    render(<EmailTemplateEditor {...defaultProps} />);
    const resetButton = screen.getByRole("button", {
      name: /reset to default/i,
    });
    fireEvent.click(resetButton);
    expect(screen.getByText("Reset to default?")).toBeInTheDocument();
  });

  it("preview button renders template", () => {
    render(<EmailTemplateEditor {...defaultProps} />);
    const previewButton = screen.getByRole("button", { name: /preview/i });
    fireEvent.click(previewButton);
    expect(mockPreviewMutate).toHaveBeenCalled();
  });
});
