import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "../user-menu";

// --- Mutable mock state ---
let mockUser: { name: string | null; email: string } | null = null;
const mockLogout = jest.fn();

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

describe("UserMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { name: "Jane Doe", email: "jane@example.com" };
  });

  it("should return null when no user", () => {
    mockUser = null;
    const { container } = render(<UserMenu />);
    expect(container.innerHTML).toBe("");
  });

  it("should show initials from two-word name", () => {
    mockUser = { name: "Jane Doe", email: "jane@example.com" };
    render(<UserMenu />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("should show initial from single-word name", () => {
    mockUser = { name: "Alice", email: "alice@example.com" };
    render(<UserMenu />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("should fall back to email initials when no name", () => {
    mockUser = { name: null, email: "zara@example.com" };
    render(<UserMenu />);
    expect(screen.getByText("ZA")).toBeInTheDocument();
  });

  it("should show user name and email in dropdown", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByTestId("user-menu-trigger"));

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("should have a Settings link", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByTestId("user-menu-trigger"));

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("should call logout on Sign out click", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByTestId("user-menu-trigger"));
    await user.click(screen.getByText("Sign out"));

    expect(mockLogout).toHaveBeenCalled();
  });
});
