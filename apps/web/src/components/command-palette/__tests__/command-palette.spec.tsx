import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPaletteProvider } from "../command-palette";

// cmdk calls scrollIntoView which doesn't exist in JSDOM
Element.prototype.scrollIntoView = vi.fn();

// --- Mutable mock state ---
let mockIsEditor = true;
let mockIsAdmin = true;
const mockPush = vi.fn();

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isEditor: mockIsEditor,
    isAdmin: mockIsAdmin,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
}));

vi.mock("@/lib/platform", () => ({
  modifierKey: () => "meta" as const,
  modifierSymbol: () => "⌘",
  isMac: () => true,
}));

function renderPalette() {
  return render(
    <CommandPaletteProvider>
      <div>App content</div>
    </CommandPaletteProvider>,
  );
}

function openPalette() {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
      }),
    );
  });
}

describe("CommandPaletteProvider", () => {
  beforeEach(() => {
    mockIsEditor = true;
    mockIsAdmin = true;
    mockPush.mockClear();
  });

  it("renders children without dialog visible by default", () => {
    renderPalette();
    expect(screen.getByText("App content")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Jump to...")).not.toBeInTheDocument();
  });

  it("opens command palette on Cmd+K", () => {
    renderPalette();
    openPalette();
    expect(screen.getByPlaceholderText("Jump to...")).toBeInTheDocument();
  });

  it("shows Writing nav group for all users", () => {
    mockIsEditor = false;
    mockIsAdmin = false;

    renderPalette();
    openPalette();

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Manuscripts")).toBeInTheDocument();
  });

  it("hides Editorial group for non-editors", () => {
    mockIsEditor = false;
    mockIsAdmin = false;

    renderPalette();
    openPalette();

    expect(screen.queryByText("Editor Dashboard")).not.toBeInTheDocument();
  });

  it("shows Editorial group for editors", () => {
    mockIsEditor = true;

    renderPalette();
    openPalette();

    expect(screen.getByText("Editor Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Reading Queue")).toBeInTheDocument();
  });

  it("navigates on item select", async () => {
    const user = userEvent.setup();

    renderPalette();
    openPalette();

    await user.click(screen.getByText("Reading Queue"));

    expect(mockPush).toHaveBeenCalledWith("/editor/queue");
  });

  it("filters items on search input", async () => {
    const user = userEvent.setup();

    renderPalette();
    openPalette();

    const input = screen.getByPlaceholderText("Jump to...");
    await user.type(input, "forms");

    expect(screen.getByText("Forms")).toBeInTheDocument();
  });
});
