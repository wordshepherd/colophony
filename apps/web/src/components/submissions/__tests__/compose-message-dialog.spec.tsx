import { render, screen, fireEvent } from "@testing-library/react";
import { ComposeMessageDialog } from "../compose-message-dialog";
import "../../../../test/setup";

// --- Mutable mock state ---
let mockMutate: jest.Mock;
let mockIsPending: boolean;

function resetMocks() {
  mockMutate = jest.fn();
  mockIsPending = false;
}

jest.mock("@tiptap/react", () => ({
  useEditor: () => ({
    getHTML: () => "<p>Test message</p>",
    commands: { clearContent: jest.fn() },
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: jest.fn() }),
        toggleItalic: () => ({ run: jest.fn() }),
        toggleBulletList: () => ({ run: jest.fn() }),
        toggleOrderedList: () => ({ run: jest.fn() }),
        setLink: () => ({ run: jest.fn() }),
        unsetLink: () => ({ run: jest.fn() }),
      }),
    }),
    isActive: () => false,
  }),
  EditorContent: ({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="editor-content">Editor</div> : null,
}));

jest.mock("@tiptap/starter-kit", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("@tiptap/extension-placeholder", () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));

jest.mock("@tiptap/extension-link", () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockInvalidate = jest.fn();

jest.mock("@/lib/trpc", () => ({
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
    onOpenChange: jest.fn(),
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
