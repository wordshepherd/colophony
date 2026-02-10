import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "../register-form";

// Mock useAuth
const mockRegister = jest.fn();
let mockRegisterError: { message: string } | null = null;
let mockIsRegisterLoading = false;

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    register: mockRegister,
    isRegisterLoading: mockIsRegisterLoading,
    registerError: mockRegisterError,
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterError = null;
    mockIsRegisterLoading = false;
    mockRegister.mockResolvedValue(undefined);
  });

  it("should render all form fields", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it("should render create account button", () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("should render login link", () => {
    render(<RegisterForm />);
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it("should call register on valid submit", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    // Click the terms checkbox
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });
    });
  });

  it("should show success state after registration", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("should display error when registration fails", async () => {
    mockRegister.mockRejectedValue(new Error("Email already taken"));
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Email already taken")).toBeInTheDocument();
    });
  });

  it("should show loading state during registration", () => {
    mockIsRegisterLoading = true;
    render(<RegisterForm />);
    expect(
      screen.getByRole("button", { name: /creating account/i }),
    ).toBeDisabled();
  });

  it("should not submit without accepting terms", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    // Don't click checkbox
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });
});
