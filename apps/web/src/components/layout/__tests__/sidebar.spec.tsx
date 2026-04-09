import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../sidebar";

// --- Mutable mock state ---
let mockIsEditor = false;
let mockIsProduction = false;
let mockIsBusinessOps = false;
let mockIsAdmin = false;
let mockPathname = "/";

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isEditor: mockIsEditor,
    isProduction: mockIsProduction,
    isBusinessOps: mockIsBusinessOps,
    isAdmin: mockIsAdmin,
  }),
}));

// Override the global next/navigation mock to control pathname per-test
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

// Override next/link mock to pass className through (default mock drops it)
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEditor = false;
    mockIsProduction = false;
    mockIsBusinessOps = false;
    mockIsAdmin = false;
    mockPathname = "/";
  });

  it("should always render My Submissions link", () => {
    render(<Sidebar />);
    expect(screen.getByText("My Submissions")).toBeInTheDocument();
  });

  it("should always render Manuscripts link", () => {
    render(<Sidebar />);
    const link = screen.getByText("Manuscripts");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/manuscripts");
  });

  it("should always render Settings link", () => {
    render(<Sidebar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should show Editorial section only when isEditor", () => {
    mockIsEditor = false;
    const { rerender } = render(<Sidebar />);
    expect(screen.queryByText("Editor Dashboard")).not.toBeInTheDocument();

    mockIsEditor = true;
    rerender(<Sidebar />);
    expect(screen.getByText("Editor Dashboard")).toBeInTheDocument();
  });

  it("should show Operations section only when isAdmin", () => {
    mockIsAdmin = false;
    const { rerender } = render(<Sidebar />);
    expect(screen.queryByText("Organization")).not.toBeInTheDocument();

    mockIsAdmin = true;
    rerender(<Sidebar />);
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("should apply active class based on pathname prefix", () => {
    mockPathname = "/submissions/123";
    render(<Sidebar />);

    const submissionsLink = screen.getByText("My Submissions").closest("a");
    // Active: has copper border
    expect(submissionsLink?.className).toMatch(/border-sidebar-primary/);

    const settingsLink = screen.getByText("Settings").closest("a");
    // Inactive: should NOT have copper border
    expect(settingsLink?.className).not.toMatch(/border-sidebar-primary/);
  });

  it("should apply active class to settings when on settings path", () => {
    mockPathname = "/settings/profile";
    render(<Sidebar />);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.className).toMatch(/border-sidebar-primary/);
  });

  it("should render Colophony brand link", () => {
    render(<Sidebar />);
    const brandLink = screen.getByRole("link", { name: /Colophony/ });
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("should have aria-label on nav element", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Main navigation");
  });

  it("should show Editorial section header text", () => {
    mockIsEditor = true;
    render(<Sidebar />);
    expect(screen.getByText("Editorial")).toBeInTheDocument();
  });

  it("should show Forms link when isEditor", () => {
    mockIsEditor = true;
    render(<Sidebar />);
    expect(screen.getByText("Forms")).toBeInTheDocument();
    const formsLink = screen.getByText("Forms").closest("a");
    expect(formsLink).toHaveAttribute("href", "/editor/forms");
  });

  it("should not highlight Editor Dashboard when on /editor/forms", () => {
    mockIsEditor = true;
    mockPathname = "/editor/forms";
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Editor Dashboard").closest("a");
    // /editor uses exact match — should NOT be active on /editor/forms
    expect(dashboardLink?.className).not.toMatch(/border-sidebar-primary/);

    const formsLink = screen.getByText("Forms").closest("a");
    // /editor/forms uses startsWith — should be active
    expect(formsLink?.className).toMatch(/border-sidebar-primary/);
  });

  it("should highlight Editor Dashboard only on exact /editor path", () => {
    mockIsEditor = true;
    mockPathname = "/editor";
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Editor Dashboard").closest("a");
    expect(dashboardLink?.className).toMatch(/border-sidebar-primary/);
  });

  it("should show Federation link in Operations section when isAdmin", () => {
    mockIsAdmin = true;
    render(<Sidebar />);
    const link = screen.getByText("Federation");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/federation");
  });

  it("should hide Editorial, Production, and Operations sections for READER (non-editor, non-admin)", () => {
    mockIsEditor = false;
    mockIsAdmin = false;
    render(<Sidebar />);
    expect(screen.queryByText("Editor Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Production Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Organization")).not.toBeInTheDocument();
    // Writing navigation always visible
    expect(screen.getByText("My Submissions")).toBeInTheDocument();
    expect(screen.getByText("Manuscripts")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should highlight Forms on sub-routes like /editor/forms/new", () => {
    mockIsEditor = true;
    mockPathname = "/editor/forms/new";
    render(<Sidebar />);

    const formsLink = screen.getByText("Forms").closest("a");
    expect(formsLink?.className).toMatch(/border-sidebar-primary/);

    const dashboardLink = screen.getByText("Editor Dashboard").closest("a");
    expect(dashboardLink?.className).not.toMatch(/border-sidebar-primary/);
  });

  it("should highlight active group header", () => {
    mockPathname = "/workspace";
    render(<Sidebar />);

    const writingHeader = screen.getByText("Writing");
    expect(writingHeader.className).toMatch(/text-sidebar-foreground/);
  });

  it("should not highlight inactive group headers", () => {
    mockIsEditor = true;
    mockPathname = "/workspace";
    render(<Sidebar />);

    const editorialHeader = screen.getByText("Editorial");
    expect(editorialHeader.className).toMatch(/text-sidebar-muted/);
  });

  // --- Sub-brand preheader tests ---

  it("should render HOPPER preheader above Writing group", () => {
    render(<Sidebar />);
    expect(screen.getByText("Hopper")).toBeInTheDocument();
  });

  it("should not repeat HOPPER preheader above Editorial", () => {
    mockIsEditor = true;
    render(<Sidebar />);
    const hopperLabels = screen.getAllByText("Hopper");
    expect(hopperLabels).toHaveLength(1);
  });

  it("should render SLATE preheader above Production", () => {
    mockIsProduction = true;
    render(<Sidebar />);
    expect(screen.getByText("Slate")).toBeInTheDocument();
  });

  it("should not repeat SLATE preheader above Business", () => {
    mockIsProduction = true;
    mockIsBusinessOps = true;
    render(<Sidebar />);
    const slateLabels = screen.getAllByText("Slate");
    expect(slateLabels).toHaveLength(1);
  });

  it("should render REGISTER preheader when admin", () => {
    mockIsAdmin = true;
    render(<Sidebar />);
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  it("should not render REGISTER preheader when not admin", () => {
    mockIsAdmin = false;
    render(<Sidebar />);
    expect(screen.queryByText("Register")).not.toBeInTheDocument();
  });

  it("should apply navy sidebar background", () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole("navigation").parentElement;
    expect(sidebar?.className).toMatch(/bg-sidebar-background/);
  });

  it("should apply copper border to active nav item", () => {
    mockPathname = "/workspace";
    render(<Sidebar />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toMatch(/border-sidebar-primary/);
  });
});
