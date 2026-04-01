import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailPane, type WorkspaceContext } from "../detail-pane";

// --- Mutable mock state ---
let mockSubmission: Record<string, unknown> | undefined;
let mockIsPending = false;
let mockMutate: ReturnType<typeof vi.fn>;
let mockInvalidate: ReturnType<typeof vi.fn>;

// --- Capture ManuscriptRenderer props ---
let capturedRendererProps: Record<string, unknown> = {};

beforeEach(() => {
  mockMutate = vi.fn();
  mockInvalidate = vi.fn();
  mockIsPending = false;
  capturedRendererProps = {};
  mockSubmission = {
    id: "sub-1",
    title: "Test Poem",
    submitterEmail: "writer@example.com",
    coverLetter: null,
    content: "First paragraph.\n\nSecond paragraph.",
    manuscript: null,
  };
});

vi.mock("@/lib/fonts", () => ({
  literata: { className: "literata-mock" },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      collections: {
        getItems: { invalidate: mockInvalidate },
      },
    }),
    submissions: {
      getById: {
        useQuery: () => ({
          data: mockSubmission,
          isPending: mockIsPending,
        }),
      },
    },
    collections: {
      updateItem: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation: (opts: any) => ({
          mutate: (...args: unknown[]) => {
            mockMutate(...args);
            opts?.onSuccess?.(
              undefined,
              args[0] as Record<string, unknown>,
              undefined,
            );
          },
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("@/components/submissions/submission-detail", () => ({
  SubmissionDetail: () => <div data-testid="submission-detail" />,
}));

vi.mock("@/components/manuscripts/manuscript-renderer", () => ({
  ManuscriptRenderer: (props: Record<string, unknown>) => {
    capturedRendererProps = props;
    return <div data-testid="manuscript-renderer" />;
  },
}));

vi.mock("@/hooks/use-density", () => ({
  DensityProvider: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/manuscript", () => ({
  textToProseMirrorDoc: (text: string) => ({
    type: "doc",
    content: text.split("\n\n").map((t) => ({ type: "paragraph", text: t })),
  }),
}));

describe("DetailPane", () => {
  const workspaceContext: WorkspaceContext = {
    collectionId: "col-1",
    itemId: "item-1",
    readingAnchor: { nodeIndex: 3, charOffset: 0 },
  };

  it("passes onAnchorChange and initialAnchor when workspaceContext is provided", () => {
    render(
      <DetailPane
        submissionId="sub-1"
        mode="deep-read"
        workspaceContext={workspaceContext}
      />,
    );

    expect(screen.getByTestId("manuscript-renderer")).toBeTruthy();
    expect(capturedRendererProps.onAnchorChange).toBeTypeOf("function");
    expect(capturedRendererProps.initialAnchor).toEqual({ nodeIndex: 3 });
  });

  it("omits onAnchorChange when no workspaceContext", () => {
    render(<DetailPane submissionId="sub-1" mode="deep-read" />);

    expect(screen.getByTestId("manuscript-renderer")).toBeTruthy();
    expect(capturedRendererProps.onAnchorChange).toBeUndefined();
  });

  it("calls updateItem.mutate with correct shape on anchor change", () => {
    render(
      <DetailPane
        submissionId="sub-1"
        mode="deep-read"
        workspaceContext={workspaceContext}
      />,
    );

    // Trigger the anchor callback passed to ManuscriptRenderer
    const onAnchorChange = capturedRendererProps.onAnchorChange as (anchor: {
      nodeIndex: number;
    }) => void;
    onAnchorChange({ nodeIndex: 7 });

    expect(mockMutate).toHaveBeenCalledWith({
      id: "col-1",
      itemId: "item-1",
      readingAnchor: { nodeIndex: 7, charOffset: 0 },
    });
  });
});
