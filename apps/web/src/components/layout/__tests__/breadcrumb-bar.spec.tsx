import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BreadcrumbBar } from "../breadcrumb-bar";

let mockPathname = "/";

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

describe("BreadcrumbBar", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("should render sub-brand, group, and page for /editor/queue", () => {
    mockPathname = "/editor/queue";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Hopper")).toBeInTheDocument();
    expect(screen.getByText("Editorial")).toBeInTheDocument();
    expect(screen.getByText("Reading Queue")).toBeInTheDocument();
  });

  it("should render sub-brand, group, and page for /slate/pipeline", () => {
    mockPathname = "/slate/pipeline";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Slate")).toBeInTheDocument();
    expect(screen.getByText("Production")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  it("should render sub-brand, group, and page for /operations", () => {
    mockPathname = "/operations";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("should handle detail routes via prefix match", () => {
    mockPathname = "/editor/collections/abc-123";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Hopper")).toBeInTheDocument();
    expect(screen.getByText("Editorial")).toBeInTheDocument();
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("should render nothing for unmatched routes", () => {
    mockPathname = "/auth/callback";
    const { container } = render(<BreadcrumbBar />);
    expect(container.innerHTML).toBe("");
  });

  it("should render group-only context for non-nav routes under a group prefix", () => {
    // /editor/something-not-in-nav should still resolve to Editorial
    mockPathname = "/editor/some-unknown-page";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Hopper")).toBeInTheDocument();
    expect(screen.getByText("Editorial")).toBeInTheDocument();
    // No page name — just sub-brand and group
    expect(screen.queryByText("some-unknown-page")).not.toBeInTheDocument();
  });

  it("should render breadcrumb for workspace routes", () => {
    mockPathname = "/workspace/analytics";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Hopper")).toBeInTheDocument();
    expect(screen.getByText("Writing")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("should have breadcrumb aria-label", () => {
    mockPathname = "/workspace";
    render(<BreadcrumbBar />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
  });

  it("should use longest prefix match for nested routes", () => {
    // /editor/forms/new should match /editor/forms (Forms), not /editor (Editor Dashboard)
    mockPathname = "/editor/forms/new";
    render(<BreadcrumbBar />);

    expect(screen.getByText("Forms")).toBeInTheDocument();
    expect(screen.queryByText("Editor Dashboard")).not.toBeInTheDocument();
  });
});
