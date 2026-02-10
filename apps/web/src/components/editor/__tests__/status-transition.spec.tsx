import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusTransition } from "../status-transition";

// Mock tRPC
const mockMutate = jest.fn();
let mockIsPending = false;

jest.mock("@/lib/trpc", () => ({
  trpc: {
    submissions: {
      updateStatus: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: Error) => void;
        }) => ({
          mutate: (input: unknown) => {
            mockMutate(input);
            if (!mockIsPending) {
              opts?.onSuccess?.();
            }
          },
          isPending: mockIsPending,
        }),
      },
    },
    useUtils: () => ({
      submissions: {
        getById: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
    }),
  },
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe("StatusTransition", () => {
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPending = false;
  });

  it("should render allowed transition buttons for SUBMITTED status", () => {
    render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="SUBMITTED"
        onStatusChange={mockOnStatusChange}
      />,
    );
    expect(
      screen.getByRole("button", { name: /under review/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("should render allowed transition buttons for UNDER_REVIEW status", () => {
    render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="UNDER_REVIEW"
        onStatusChange={mockOnStatusChange}
      />,
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /put on hold/i }),
    ).toBeInTheDocument();
  });

  it("should return null for terminal statuses", () => {
    const { container } = render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="ACCEPTED"
        onStatusChange={mockOnStatusChange}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("should open dialog on button click", async () => {
    const user = userEvent.setup();
    render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="SUBMITTED"
        onStatusChange={mockOnStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(screen.getByText("Reject Submission")).toBeInTheDocument();
    });
  });

  it("should show accept dialog content", async () => {
    const user = userEvent.setup();
    render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="UNDER_REVIEW"
        onStatusChange={mockOnStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => {
      expect(screen.getByText("Accept Submission")).toBeInTheDocument();
      expect(
        screen.getByText(/accept the submission for publication/i),
      ).toBeInTheDocument();
    });
  });

  it("should call mutation on confirm", async () => {
    const user = userEvent.setup();
    render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="SUBMITTED"
        onStatusChange={mockOnStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /under review/i }));

    await waitFor(() => {
      expect(screen.getByText(/confirm/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      id: "sub-1",
      data: {
        status: "UNDER_REVIEW",
        comment: undefined,
      },
    });
  });

  it("should close dialog on cancel", async () => {
    const user = userEvent.setup();
    render(
      <StatusTransition
        submissionId="sub-1"
        currentStatus="SUBMITTED"
        onStatusChange={mockOnStatusChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(screen.getByText("Reject Submission")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Reject Submission")).not.toBeInTheDocument();
    });
  });
});
