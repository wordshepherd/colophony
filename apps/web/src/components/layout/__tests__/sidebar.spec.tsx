import React from "react";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../sidebar";

// --- Mutable mock state ---
let mockIsEditor = false;
let mockIsAdmin = false;
let mockPathname = "/";

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

  it("should show Editor section header text", () => {
    mockIsEditor = true;
    render(<Sidebar />);
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });
});
