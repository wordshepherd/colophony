import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockEndpoint: Record<string, unknown> | null = null;
let mockDeliveries: unknown[] = [];
let mockIsLoading = false;
let mockIsAdmin = true;

function resetMocks() {
  mockEndpoint = {
    id: "ep-1",
    url: "https://example.com/hook",
    description: "Test endpoint",
    eventTypes: ["hopper/submission.submitted", "hopper/submission.accepted"],
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  mockDeliveries = [
    {
      id: "del-1",
      webhookEndpointId: "ep-1",
      eventType: "hopper/submission.submitted",
      eventId: "evt-1",
      payload: {},
      status: "DELIVERED",
      httpStatusCode: 200,
      responseBody: null,
      errorMessage: null,
      attempts: 1,
      nextRetryAt: null,
      deliveredAt: "2026-01-01T00:01:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  mockIsLoading = false;
  mockIsAdmin = true;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    webhooks: {
      getById: {
        useQuery: () => ({
          data: mockIsLoading ? undefined : mockEndpoint,
          isPending: mockIsLoading,
        }),
      },
      deliveries: {
        useQuery: () => ({
          data: mockIsLoading
            ? undefined
            : {
                items: mockDeliveries,
                total: mockDeliveries.length,
                page: 1,
                limit: 20,
                totalPages: 1,
              },
          isPending: mockIsLoading,
        }),
      },
      delete: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      rotateSecret: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      test: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      retryDelivery: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      webhooks: {
        getById: { invalidate: vi.fn() },
        deliveries: { invalidate: vi.fn() },
      },
    }),
  },
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isAdmin: mockIsAdmin,
    isEditor: true,
  }),
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

import { WebhookDetail } from "../webhook-detail";

describe("WebhookDetail", () => {
  beforeEach(resetMocks);

  it("renders endpoint URL and event subscriptions", () => {
    render(<WebhookDetail endpointId="ep-1" />);
    expect(screen.getByText("https://example.com/hook")).toBeInTheDocument();
    // May appear in both event subscriptions badges and delivery log
    expect(
      screen.getAllByText("hopper/submission.submitted").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("hopper/submission.accepted").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders delivery log with status", () => {
    render(<WebhookDetail endpointId="ep-1" />);
    expect(screen.getByText("Delivery Log")).toBeInTheDocument();
    expect(screen.getByText("DELIVERED")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows action buttons for admins", () => {
    render(<WebhookDetail endpointId="ep-1" />);
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Rotate Secret")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("hides action buttons for non-admins", () => {
    mockIsAdmin = false;
    render(<WebhookDetail endpointId="ep-1" />);
    expect(screen.queryByText("Test")).toBeNull();
    expect(screen.queryByText("Rotate Secret")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows not-found state when endpoint is null", () => {
    mockEndpoint = null;
    render(<WebhookDetail endpointId="ep-1" />);
    expect(screen.getByText("Webhook endpoint not found")).toBeInTheDocument();
  });
});
