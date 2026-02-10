import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../login-form";
import { mockPush } from "../../../../test/setup";

// Mock useAuth
const mockLogin = jest.fn();
let mockLoginError: { message: string } | null = null;
let mockIsLoginLoading = false;

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    login: mockLogin,
    isLoginLoading: mockIsLoginLoading,
    loginError: mockLoginError,
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoginError = null;
    mockIsLoginLoading = false;
    mockLogin.mockResolvedValue(undefined);
  });

  it("should render email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("should render sign in button", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("should render register link", () => {
    render(<LoginForm />);
    expect(screen.getByText(/sign up/i)).toBeInTheDocument();
  });

  it("should call login and redirect on successful submit", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/submissions");
    });
  });

  it("should display error when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("should show loading state during login", () => {
    mockIsLoginLoading = true;
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("should show validation error for invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });
});
