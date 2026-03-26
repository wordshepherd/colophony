import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EditorialSplitPane } from "../editorial-split-pane";

// Mock resizable panels
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: React.PropsWithChildren) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({ children }: React.PropsWithChildren) => (
    <div data-testid="panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="panel-handle" />,
}));

// Mock child components to avoid deep tRPC dependency trees
vi.mock("../triage-list", () => ({
  TriageList: ({
    selectedId,
    onSelect,
    onItemsChange,
  }: {
    selectedId: string | null;
    onSelect: (id: string) => void;
    onItemsChange?: (ids: string[]) => void;
  }) => {
    // Simulate items being available via useEffect equivalent
    if (onItemsChange) {
      // Call synchronously (simulates the effect)
      setTimeout(() => onItemsChange(["sub-1", "sub-2", "sub-3"]), 0);
    }
    return (
      <div data-testid="triage-list">
        <button
          data-testid="item-sub-1"
          aria-selected={selectedId === "sub-1"}
          role="option"
          onClick={() => onSelect("sub-1")}
        >
          The River House
        </button>
        <button
          data-testid="item-sub-2"
          aria-selected={selectedId === "sub-2"}
          role="option"
          onClick={() => onSelect("sub-2")}
        >
          Memory Palace
        </button>
        <button
          data-testid="item-sub-3"
          aria-selected={selectedId === "sub-3"}
          role="option"
          onClick={() => onSelect("sub-3")}
        >
          After the Rain
        </button>
      </div>
    );
  },
}));

vi.mock("../detail-pane", () => ({
  DetailPane: ({
    submissionId,
    mode,
  }: {
    submissionId: string | null;
    mode: string;
  }) => (
    <div
      data-testid="detail-pane"
      data-mode={mode}
      data-submission={submissionId}
    >
      {submissionId
        ? `Detail: ${submissionId} (${mode})`
        : "No submission selected"}
    </div>
  ),
}));

vi.mock("../queue-rail", () => ({
  QueueRail: ({
    currentIndex,
    totalCount,
    onExpand,
  }: {
    currentIndex: number;
    totalCount: number;
    onExpand: () => void;
  }) => (
    <div data-testid="queue-rail" onClick={onExpand}>
      {currentIndex + 1} of {totalCount}
    </div>
  ),
}));

// Mock window.history.replaceState
const replaceStateSpy = vi.spyOn(window.history, "replaceState");

describe("EditorialSplitPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders triage mode by default with list and detail panels", () => {
    render(<EditorialSplitPane />);

    expect(screen.getByTestId("triage-list")).toBeTruthy();
    expect(screen.getByTestId("detail-pane")).toBeTruthy();
    expect(screen.getByText("No submission selected")).toBeTruthy();
  });

  it("selecting a submission updates the detail pane and URL", () => {
    render(<EditorialSplitPane />);

    fireEvent.click(screen.getByTestId("item-sub-1"));

    expect(screen.getByText("Detail: sub-1 (triage)")).toBeTruthy();
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/editor/queue?id=sub-1",
    );
  });

  it("pressing r switches to deep-read mode when a submission is selected", () => {
    render(<EditorialSplitPane initialId="sub-1" />);

    // Let the onItemsChange callback fire
    act(() => {
      vi.advanceTimersByTime(10);
    });

    fireEvent.keyDown(document, { key: "r" });

    // Should see rail and deep-read detail
    expect(screen.getByTestId("queue-rail")).toBeTruthy();
    expect(screen.getByText("Detail: sub-1 (deep-read)")).toBeTruthy();
  });

  it("pressing Escape returns to triage mode from deep-read", () => {
    render(<EditorialSplitPane initialId="sub-1" />);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    // Enter deep-read
    fireEvent.keyDown(document, { key: "r" });
    expect(screen.getByTestId("queue-rail")).toBeTruthy();

    // Return to triage
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("triage-list")).toBeTruthy();
    expect(screen.queryByTestId("queue-rail")).toBeNull();
  });

  it("j/k moves selection through list items", () => {
    render(<EditorialSplitPane />);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    // j selects first item
    fireEvent.keyDown(document, { key: "j" });
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/editor/queue?id=sub-1",
    );

    // j again selects second
    fireEvent.keyDown(document, { key: "j" });
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/editor/queue?id=sub-2",
    );

    // k goes back to first
    fireEvent.keyDown(document, { key: "k" });
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/editor/queue?id=sub-1",
    );
  });

  it("r does not activate deep-read when no submission is selected", () => {
    render(<EditorialSplitPane />);

    fireEvent.keyDown(document, { key: "r" });

    // Should still be in triage mode
    expect(screen.getByTestId("triage-list")).toBeTruthy();
    expect(screen.queryByTestId("queue-rail")).toBeNull();
  });

  it("pre-selects submission from initialId prop", () => {
    render(<EditorialSplitPane initialId="sub-2" />);

    expect(screen.getByText("Detail: sub-2 (triage)")).toBeTruthy();
  });

  it("clicking rail expand button returns to triage", () => {
    render(<EditorialSplitPane initialId="sub-1" />);
    act(() => {
      vi.advanceTimersByTime(10);
    });

    // Enter deep-read
    fireEvent.keyDown(document, { key: "r" });
    expect(screen.getByTestId("queue-rail")).toBeTruthy();

    // Click rail to expand
    fireEvent.click(screen.getByTestId("queue-rail"));
    expect(screen.getByTestId("triage-list")).toBeTruthy();
  });
});
