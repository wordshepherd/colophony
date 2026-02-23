import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmbedIdentityStep } from "../embed-identity-step";
import "../../../../test/setup";

describe("EmbedIdentityStep", () => {
  const defaultProps = {
    periodName: "Spring 2026 Submissions",
    onContinue: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires email field", async () => {
    const user = userEvent.setup();
    render(<EmbedIdentityStep {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email/i),
      ).toBeInTheDocument();
    });

    expect(defaultProps.onContinue).not.toHaveBeenCalled();
  });

  it("validates email format", async () => {
    const user = userEvent.setup();
    render(<EmbedIdentityStep {...defaultProps} />);

    // Type an invalid email and submit
    const emailInput = screen.getByPlaceholderText("your@email.com");
    await user.type(emailInput, "notanemail");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // RHF with zodResolver rejects invalid email — onContinue should not fire.
    // Note: jsdom's type="email" native validation may prevent form submission
    // before Zod runs, so we check the behavioral outcome rather than error text.
    await waitFor(() => {
      expect(defaultProps.onContinue).not.toHaveBeenCalled();
    });
  });

  it("name is optional", async () => {
    const user = userEvent.setup();
    render(<EmbedIdentityStep {...defaultProps} />);

    await user.type(screen.getByLabelText(/email/i), "writer@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(defaultProps.onContinue).toHaveBeenCalledWith({
        email: "writer@example.com",
        name: undefined,
      });
    });
  });

  it("calls onContinue with email and name", async () => {
    const user = userEvent.setup();
    render(<EmbedIdentityStep {...defaultProps} />);

    await user.type(screen.getByLabelText(/email/i), "writer@example.com");
    await user.type(screen.getByLabelText(/name/i), "Jane Doe");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(defaultProps.onContinue).toHaveBeenCalledWith({
        email: "writer@example.com",
        name: "Jane Doe",
      });
    });
  });
});
