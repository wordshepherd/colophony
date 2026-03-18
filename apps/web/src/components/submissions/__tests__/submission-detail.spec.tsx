import { vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubmissionDetail } from "../submission-detail";

// --- Mutable mock state ---
let mockSubmission: Record<string, unknown> | undefined;
let mockIsLoading: boolean;
let mockIsEditor: boolean;
let mockIsAdmin: boolean;
let mockUserId: string;
let mockReviewers: Array<{ reviewerUserId: string }>;
let mockHistory: Array<Record<string, unknown>>;

function resetMocks() {
  mockIsLoading = false;
  mockIsEditor = true;
  mockIsAdmin = false;
  mockUserId = "user-editor";
  mockReviewers = [];
  mockHistory = [];
  mockSubmission = {
    id: "sub-1",
    title: "Test Poem",
    content: "Line one\nLine two",
    coverLetter: null,
    status: "SUBMITTED",
    submitterId: "user-submitter",
    manuscriptVersionId: "mv-1",
    formDefinitionId: null,
    formData: null,
    createdAt: "2026-01-14T12:00:00.000Z",
    manuscript: null,
  };
}

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    user: { id: mockUserId },
    isEditor: mockIsEditor,
    isAdmin: mockIsAdmin,
    currentOrg: { id: "org-1", name: "Test Org", role: "EDITOR" },
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      submissions: {
        getById: { invalidate: vi.fn() },
        getHistory: { invalidate: vi.fn() },
      },
      files: {
        getDownloadUrl: { fetch: vi.fn() },
      },
    }),
    submissions: {
      getById: {
        useQuery: () => ({
          data: mockSubmission,
          isPending: mockIsLoading,
        }),
      },
      getHistory: {
        useQuery: () => ({ data: mockHistory }),
      },
      listReviewers: {
        useQuery: () => ({ data: mockReviewers }),
      },
      markReviewerRead: {
        useMutation: () => ({ mutate: vi.fn() }),
      },
      delete: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      withdraw: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    files: {
      listByManuscriptVersion: {
        useQuery: () => ({ data: [] }),
      },
    },
    organizations: {
      get: {
        useQuery: () => ({ data: { settings: {} } }),
      },
    },
  },
}));

vi.mock("../status-transition", () => ({
  StatusTransition: () => <div data-testid="status-transition" />,
}));

vi.mock("../revise-and-resubmit-card", () => ({
  ReviseAndResubmitCard: () => <div data-testid="rr-card" />,
}));

vi.mock("../compose-message-dialog", () => ({
  ComposeMessageDialog: () => null,
}));

vi.mock("../correspondence-history", () => ({
  CorrespondenceHistory: () => <div data-testid="correspondence" />,
}));

vi.mock("../reviewer-list", () => ({
  ReviewerList: () => <div data-testid="reviewer-list" />,
}));

vi.mock("../reviewer-picker", () => ({
  ReviewerPicker: () => <div data-testid="reviewer-picker" />,
}));

vi.mock("../discussion-thread", () => ({
  DiscussionThread: () => <div data-testid="discussion-thread" />,
}));

vi.mock("../voting-panel", () => ({
  VotingPanel: () => <div data-testid="voting-panel" />,
}));

vi.mock("../form-renderer/read-only-form-fields", () => ({
  ReadOnlyFormFields: () => <div data-testid="form-fields" />,
}));

beforeEach(() => {
  resetMocks();
  mockPush.mockClear();
});

describe("SubmissionDetail — Reading Mode", () => {
  it("shows reading mode toggle for editor", () => {
    render(<SubmissionDetail submissionId="sub-1" />);
    expect(
      screen.getByRole("button", { name: /toggle reading mode/i }),
    ).toBeInTheDocument();
  });

  it("hides reading mode toggle for non-editor owner", () => {
    mockIsEditor = false;
    mockIsAdmin = false;
    mockUserId = "user-submitter";
    render(<SubmissionDetail submissionId="sub-1" />);
    expect(
      screen.queryByRole("button", { name: /toggle reading mode/i }),
    ).not.toBeInTheDocument();
  });

  it("hides editor actions in reading mode", () => {
    render(<SubmissionDetail submissionId="sub-1" />);
    expect(screen.getByText("Editor Actions")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /toggle reading mode/i }),
    );

    expect(screen.queryByText("Editor Actions")).not.toBeInTheDocument();
  });

  it("shows next/prev nav with queue context", () => {
    render(
      <SubmissionDetail
        submissionId="b"
        queueIds={["a", "b", "c"]}
        queueIdx={1}
      />,
    );

    expect(screen.getByText("Previous")).toBeEnabled();
    expect(screen.getByText("Next")).toBeEnabled();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("disables Previous on first item", () => {
    render(
      <SubmissionDetail
        submissionId="a"
        queueIds={["a", "b", "c"]}
        queueIdx={0}
      />,
    );

    expect(screen.getByText("Previous").closest("button")).toBeDisabled();
    expect(screen.getByText("Next").closest("button")).toBeEnabled();
  });

  it("disables Next on last item", () => {
    render(
      <SubmissionDetail
        submissionId="c"
        queueIds={["a", "b", "c"]}
        queueIdx={2}
      />,
    );

    expect(screen.getByText("Previous").closest("button")).toBeEnabled();
    expect(screen.getByText("Next").closest("button")).toBeDisabled();
  });

  it("hides nav bar without queue context", () => {
    render(<SubmissionDetail submissionId="sub-1" />);
    expect(screen.queryByText(/^\d+ of \d+$/)).not.toBeInTheDocument();
  });
});
