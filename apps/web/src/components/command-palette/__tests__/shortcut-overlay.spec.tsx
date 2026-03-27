import { vi, describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ShortcutOverlay } from "../shortcut-overlay";

vi.mock("@/lib/platform", () => ({
  modifierSymbol: () => "⌘",
  isMac: () => true,
}));

describe("ShortcutOverlay", () => {
  it("renders shortcut groups when open", () => {
    render(<ShortcutOverlay open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Editorial (Reading Queue)")).toBeInTheDocument();
  });

  it("shows platform-appropriate modifier symbol", () => {
    render(<ShortcutOverlay open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("⌘+K")).toBeInTheDocument();
  });

  it("shows editorial shortcuts", () => {
    render(<ShortcutOverlay open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Next submission")).toBeInTheDocument();
    expect(screen.getByText("Previous submission")).toBeInTheDocument();
    expect(screen.getByText("Enter deep-read mode")).toBeInTheDocument();
    expect(screen.getByText("Return to triage")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ShortcutOverlay open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when close is requested", () => {
    const onOpenChange = vi.fn();
    render(<ShortcutOverlay open={true} onOpenChange={onOpenChange} />);

    // Dialog close button (X) or overlay click
    const closeButton = screen.getByRole("button", { name: /close/i });
    closeButton.click();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
