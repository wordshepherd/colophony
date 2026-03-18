import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

const mockMutate = vi.fn();
let mockIsPending = false;

function resetMocks() {
  mockMutate.mockClear();
  mockIsPending = false;
}

vi.mock("@/lib/trpc", () => ({
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
