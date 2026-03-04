import React from "react";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../sidebar";

// --- Mutable mock state ---
let mockIsEditor = false;
let mockIsAdmin = false;
let mockPathname = "/";

jest.mock("@/components/plugins/plugin-slot", () => ({
  PluginSlot: () => null,
}));

jest.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isEditor: mockIsEditor,
    isAdmin: mockIsAdmin,
  }),
}));

// Override the global next/navigation mock to control pathname per-test
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

// Override next/link mock to pass className through (default mock drops it)
jest.mock("next/link", () => ({
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
    jest.clearAllMocks();
    mockIsEditor = false;
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

  it("should show Editor section only when isEditor", () => {
    mockIsEditor = false;
    const { rerender } = render(<Sidebar />);
    expect(screen.queryByText("Editor Dashboard")).not.toBeInTheDocument();

    mockIsEditor = true;
    rerender(<Sidebar />);
    expect(screen.getByText("Editor Dashboard")).toBeInTheDocument();
  });

  it("should show Admin section only when isAdmin", () => {
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
    // Active: has "bg-accent" as a standalone class (not hover:bg-accent)
    expect(submissionsLink?.className).toMatch(/(?:^|\s)bg-accent(?:\s|$)/);

    const settingsLink = screen.getByText("Settings").closest("a");
    // Inactive: should NOT have standalone "bg-accent" (hover:bg-accent is fine)
    expect(settingsLink?.className).not.toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
  });

  it("should apply active class to settings when on settings path", () => {
    mockPathname = "/settings/profile";
    render(<Sidebar />);

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink?.className).toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
  });

  it("should render Colophony brand link", () => {
    render(<Sidebar />);
    const brandLink = screen.getByText("Colophony").closest("a");
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("should have aria-label on nav element", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Main navigation");
  });

  it("should show Editor section header text", () => {
    mockIsEditor = true;
    render(<Sidebar />);
    expect(screen.getByText("Editor")).toBeInTheDocument();
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
    expect(dashboardLink?.className).not.toMatch(/(?:^|\s)bg-accent(?:\s|$)/);

    const formsLink = screen.getByText("Forms").closest("a");
    // /editor/forms uses startsWith — should be active
    expect(formsLink?.className).toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
  });

  it("should highlight Editor Dashboard only on exact /editor path", () => {
    mockIsEditor = true;
    mockPathname = "/editor";
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Editor Dashboard").closest("a");
    expect(dashboardLink?.className).toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
  });

  it("should show Federation link in admin section when isAdmin", () => {
    mockIsAdmin = true;
    render(<Sidebar />);
    const link = screen.getByText("Federation");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/federation");
  });

  it("should hide Editor, Slate, and Admin sections for READER (non-editor, non-admin)", () => {
    mockIsEditor = false;
    mockIsAdmin = false;
    render(<Sidebar />);
    expect(screen.queryByText("Editor Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Slate Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Organization")).not.toBeInTheDocument();
    // Submitter navigation always visible
    expect(screen.getByText("My Submissions")).toBeInTheDocument();
    expect(screen.getByText("Manuscripts")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should highlight Forms on sub-routes like /editor/forms/new", () => {
    mockIsEditor = true;
    mockPathname = "/editor/forms/new";
    render(<Sidebar />);

    const formsLink = screen.getByText("Forms").closest("a");
    expect(formsLink?.className).toMatch(/(?:^|\s)bg-accent(?:\s|$)/);

    const dashboardLink = screen.getByText("Editor Dashboard").closest("a");
    expect(dashboardLink?.className).not.toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
  });
});
