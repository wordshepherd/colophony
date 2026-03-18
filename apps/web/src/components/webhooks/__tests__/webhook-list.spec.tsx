import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Mutable mock state
let mockWebhooks: unknown[] = [];
let mockIsPending = false;
let mockIsAdmin = true;

function resetMocks() {
  mockWebhooks = [];
  mockIsPending = false;
  mockIsAdmin = true;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    webhooks: {
      list: {
        useQuery: () => ({
          data: mockIsPending
            ? undefined
            : {
                items: mockWebhooks,
                total: mockWebhooks.length,
                page: 1,
                limit: 20,
                totalPages: 1,
              },
          isPending: mockIsPending,
        }),
      },
    },
  },
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isAdmin: mockIsAdmin,
    isEditor: true,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/webhooks",
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

import { WebhookList } from "../webhook-list";

describe("WebhookList", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    render(<WebhookList />);
    // Skeletons are rendered (no table)
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders empty state with CTA when no webhooks exist", () => {
    mockWebhooks = [];
    render(<WebhookList />);
    expect(
      screen.getByText("No webhook endpoints configured"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create your first webhook endpoint"),
    ).toBeInTheDocument();
  });

  it("renders webhook list with URL, events, and status", () => {
    mockWebhooks = [
      {
        id: "ep-1",
        url: "https://example.com/hook",
        description: "Test hook",
        eventTypes: ["hopper/submission.submitted"],
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    render(<WebhookList />);
    expect(screen.getByText("https://example.com/hook")).toBeInTheDocument();
    expect(screen.getByText("1 event")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("hides new webhook button for non-admins", () => {
    mockIsAdmin = false;
    render(<WebhookList />);
    expect(screen.queryByText("New Webhook")).toBeNull();
  });
});
