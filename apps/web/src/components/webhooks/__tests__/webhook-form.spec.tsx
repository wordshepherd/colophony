import React from "react";
import { render, screen } from "@testing-library/react";
import "../../../../test/setup";

const mockMutate = jest.fn();
let mockIsPending = false;

function resetMocks() {
  mockMutate.mockClear();
  mockIsPending = false;
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    webhooks: {
      create: {
        useMutation: (opts: Record<string, unknown>) => ({
          mutate: (data: unknown) => {
            mockMutate(data);
            if (typeof opts.onSuccess === "function")
              (opts.onSuccess as (d: unknown) => void)({
                secret: "test-secret",
              });
          },
          isPending: mockIsPending,
        }),
      },
    },
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { WebhookForm } from "../webhook-form";

describe("WebhookForm", () => {
  beforeEach(resetMocks);

  it("renders URL input and event type checkboxes", () => {
    render(<WebhookForm />);
    expect(
      screen.getByPlaceholderText("https://example.com/webhooks"),
    ).toBeInTheDocument();
    expect(screen.getByText("Submission Submitted")).toBeInTheDocument();
    expect(screen.getByText("Issue Published")).toBeInTheDocument();
  });

  it("renders create button", () => {
    render(<WebhookForm />);
    expect(screen.getByText("Create Webhook")).toBeInTheDocument();
  });
});
