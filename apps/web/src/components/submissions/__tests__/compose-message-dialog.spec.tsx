import { vi, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComposeMessageDialog } from "../compose-message-dialog";

// --- Mutable mock state ---
let mockMutate: Mock;
let mockIsPending: boolean;

function resetMocks() {
  mockMutate = vi.fn();
  mockIsPending = false;
}

vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    getHTML: () => "<p>Test message</p>",
    commands: { clearContent: vi.fn() },
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        setLink: () => ({ run: vi.fn() }),
        unsetLink: () => ({ run: vi.fn() }),
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

const mockInvalidate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    correspondence: {
      send: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: { message: string }) => void;
        }) => ({
          mutate: (...args: unknown[]) => {
            mockMutate(...args);
            if (!mockIsPending) opts.onSuccess?.();
          },
          isPending: mockIsPending,
        }),
      },
    },
    useUtils: () => ({
      correspondence: {
        listBySubmission: { invalidate: mockInvalidate },
      },
    }),
  },
}));

beforeEach(() => {
  resetMocks();
});

describe("ComposeMessageDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    submissionId: "sub-1",
    submissionTitle: "My Poem",
  };

  it("pre-fills subject with Re: submission title", () => {
    render(<ComposeMessageDialog {...defaultProps} />);
    const input = screen.getByLabelText("Subject") as HTMLInputElement;
    expect(input.value).toBe("Re: My Poem");
  });

  it("calls send mutation on submit", () => {
    render(<ComposeMessageDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(mockMutate).toHaveBeenCalledWith({
      submissionId: "sub-1",
      subject: "Re: My Poem",
      body: "<p>Test message</p>",
    });
  });

  it("disables send button while pending", () => {
    mockIsPending = true;
    render(<ComposeMessageDialog {...defaultProps} />);
    const sendBtn = screen.getByRole("button", { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });

  it("shows error toast on failure", () => {
    expect(mockToastError).toBeDefined();
  });

  it("closes dialog and shows success toast on success", () => {
    render(<ComposeMessageDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Message sent");
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
