import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "../header";

// --- Mutable mock state ---
let mockPathname = "/";
let mockIsAuthenticated = true;
const mockLogin = vi.fn();

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

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    login: mockLogin,
  }),
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    currentOrg: {
      id: "org-1",
      name: "Test Org",
      slug: "test-org",
      role: "ADMIN",
    },
    organizations: [
      { id: "org-1", name: "Test Org", slug: "test-org", role: "ADMIN" },
    ],
    switchOrganization: vi.fn(),
    isAdmin: true,
  }),
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}));

const mockSetOpen = vi.fn();
vi.mock("@/components/command-palette/command-palette", () => ({
  useCommandPalette: () => ({ open: false, setOpen: mockSetOpen }),
}));

vi.mock("@/lib/platform", () => ({
  modifierSymbol: () => "⌘",
  modifierKey: () => "meta",
  isMac: () => true,
}));

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
    mockIsAuthenticated = true;
  });

  it("renders hamburger menu button on mobile", () => {
    render(<Header />);
    const toggleButton = screen.getByRole("button", { name: /toggle menu/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it("hides hamburger on desktop via md:hidden class", () => {
    render(<Header />);
    const toggleButton = screen.getByRole("button", { name: /toggle menu/i });
    expect(toggleButton.className).toContain("md:hidden");
  });

  it("renders navigation sheet when opened", async () => {
    const user = userEvent.setup();
    render(<Header />);

    const toggleButton = screen.getByRole("button", { name: /toggle menu/i });
    await user.click(toggleButton);

    // Sheet should be open — Sidebar renders navigation links
    expect(screen.getByText("My Submissions")).toBeInTheDocument();
  });

  it("includes accessible sheet title", async () => {
    const user = userEvent.setup();
    render(<Header />);

    const toggleButton = screen.getByRole("button", { name: /toggle menu/i });
    await user.click(toggleButton);

    const sheetTitle = screen.getByText("Navigation");
    expect(sheetTitle).toBeInTheDocument();
    expect(sheetTitle.className).toContain("sr-only");
  });

  it("closes sheet on pathname change", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Header />);

    // Open the sheet
    const toggleButton = screen.getByRole("button", { name: /toggle menu/i });
    await user.click(toggleButton);

    // Verify sheet is open
    expect(screen.getByText("My Submissions")).toBeInTheDocument();

    // Simulate navigation by changing pathname and re-rendering
    mockPathname = "/submissions";
    rerender(<Header />);

    // The sheet content should no longer be visible
    // (controlled state reset during render when pathname changes)
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
  });

  it("renders sign in button when not authenticated", () => {
    mockIsAuthenticated = false;
    render(<Header />);

    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("renders org switcher and user menu when authenticated", () => {
    render(<Header />);

    expect(screen.getByText("Test Org")).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("renders command palette trigger button when authenticated", () => {
    render(<Header />);

    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("opens command palette on trigger click", async () => {
    const user = userEvent.setup();
    render(<Header />);

    const trigger = screen.getByText("⌘K").closest("button")!;
    await user.click(trigger);

    expect(mockSetOpen).toHaveBeenCalledWith(true);
  });
});
