import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const mockListPeers = vi.fn();
const mockQueueHealth = vi.fn();
const mockWebhookHealth = vi.fn();
const mockSubmissionTrend = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    federation: {
      listPeers: {
        useQuery: (...args: unknown[]) => mockListPeers(...args),
      },
    },
    ops: {
      queueHealth: {
        useQuery: (...args: unknown[]) => mockQueueHealth(...args),
      },
      webhookProviderHealth: {
        useQuery: (...args: unknown[]) => mockWebhookHealth(...args),
      },
      submissionTrend: {
        useQuery: (...args: unknown[]) => mockSubmissionTrend(...args),
      },
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { HealthCardGrid } from "../health-card-grid";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadingState() {
  return { data: undefined, isPending: true, error: null };
}

function loaded<T>(data: T) {
  return { data, isPending: false, error: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HealthCardGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four health cards", () => {
    mockListPeers.mockReturnValue(
      loaded([{ status: "active" }, { status: "active" }]),
    );
    mockQueueHealth.mockReturnValue(
      loaded({
        queues: [
          { name: "email", waiting: 0, active: 0, delayed: 0, failed: 0 },
        ],
      }),
    );
    mockWebhookHealth.mockReturnValue(
      loaded({
        providers: [
          {
            provider: "zitadel",
            status: "healthy",
            lastReceivedAt: "2026-03-27T00:00:00Z",
          },
        ],
      }),
    );
    mockSubmissionTrend.mockReturnValue(
      loaded({ thisMonth: 5, lastMonth: 3, trend: "up" }),
    );

    render(<HealthCardGrid />);

    expect(screen.getByText("Federation")).toBeInTheDocument();
    expect(screen.getByText("Queues")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Submissions")).toBeInTheDocument();
  });

  it("derives healthy federation status when all peers active", () => {
    mockListPeers.mockReturnValue(
      loaded([
        { status: "active" },
        { status: "active" },
        { status: "active" },
      ]),
    );
    mockQueueHealth.mockReturnValue(loadingState());
    mockWebhookHealth.mockReturnValue(loadingState());
    mockSubmissionTrend.mockReturnValue(loadingState());

    render(<HealthCardGrid />);

    expect(screen.getByText("3 active")).toBeInTheDocument();
    // The metric should have green styling (healthy)
    const metric = screen.getByText("3 active");
    expect(metric.className).toContain("text-green-700");
  });

  it("derives degraded federation status when peers pending", () => {
    mockListPeers.mockReturnValue(
      loaded([{ status: "active" }, { status: "pending_inbound" }]),
    );
    mockQueueHealth.mockReturnValue(loadingState());
    mockWebhookHealth.mockReturnValue(loadingState());
    mockSubmissionTrend.mockReturnValue(loadingState());

    render(<HealthCardGrid />);

    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getByText("1 pending")).toBeInTheDocument();
    // Degraded = yellow
    const metric = screen.getByText("1 active");
    expect(metric.className).toContain("text-yellow-700");
  });

  it("derives correct queue status from job counts", () => {
    mockListPeers.mockReturnValue(loadingState());
    mockQueueHealth.mockReturnValue(
      loaded({
        queues: [
          { name: "email", waiting: 10, active: 2, delayed: 0, failed: 3 },
          { name: "webhook", waiting: 5, active: 0, delayed: 0, failed: 0 },
        ],
      }),
    );
    mockWebhookHealth.mockReturnValue(loadingState());
    mockSubmissionTrend.mockReturnValue(loadingState());

    render(<HealthCardGrid />);

    expect(screen.getByText("15 waiting")).toBeInTheDocument();
    expect(screen.getByText("3 failed")).toBeInTheDocument();
    // failed > 0 = degraded = yellow
    const metric = screen.getByText("15 waiting");
    expect(metric.className).toContain("text-yellow-700");
  });

  it("derives correct webhook status from provider health", () => {
    mockListPeers.mockReturnValue(loadingState());
    mockQueueHealth.mockReturnValue(loadingState());
    mockWebhookHealth.mockReturnValue(
      loaded({
        providers: [
          {
            provider: "zitadel",
            status: "healthy",
            lastReceivedAt: "2026-03-27T00:00:00Z",
          },
          {
            provider: "stripe",
            status: "stale",
            lastReceivedAt: "2026-03-20T00:00:00Z",
          },
          {
            provider: "documenso",
            status: "healthy",
            lastReceivedAt: "2026-03-27T00:00:00Z",
          },
        ],
      }),
    );
    mockSubmissionTrend.mockReturnValue(loadingState());

    render(<HealthCardGrid />);

    expect(screen.getByText("2/3 healthy")).toBeInTheDocument();
    expect(screen.getByText("Stale: stripe")).toBeInTheDocument();
    // stale = degraded = yellow
    const metric = screen.getByText("2/3 healthy");
    expect(metric.className).toContain("text-yellow-700");
  });

  it("shows loading state while queries pending", () => {
    mockListPeers.mockReturnValue(loadingState());
    mockQueueHealth.mockReturnValue(loadingState());
    mockWebhookHealth.mockReturnValue(loadingState());
    mockSubmissionTrend.mockReturnValue(loadingState());

    const { container } = render(<HealthCardGrid />);

    // All cards should be in loading state (skeletons visible)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
