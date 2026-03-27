import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const mockAuditList = vi.fn();
const mockListPeers = vi.fn();
const mockQueueHealth = vi.fn();
const mockWebhookHealth = vi.fn();
const mockSubmissionTrend = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    audit: {
      list: { useQuery: (...args: unknown[]) => mockAuditList(...args) },
    },
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

import { OpsDashboard } from "../ops-dashboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadingState() {
  return { data: undefined, isPending: true, error: null };
}

function setupDefaultMocks() {
  mockListPeers.mockReturnValue({
    data: [{ status: "active" }],
    isPending: false,
    error: null,
  });
  mockQueueHealth.mockReturnValue({
    data: {
      queues: [{ name: "email", waiting: 0, active: 0, delayed: 0, failed: 0 }],
    },
    isPending: false,
    error: null,
  });
  mockWebhookHealth.mockReturnValue({
    data: {
      providers: [
        {
          provider: "zitadel",
          status: "healthy",
          lastReceivedAt: "2026-03-27T00:00:00Z",
        },
      ],
    },
    isPending: false,
    error: null,
  });
  mockSubmissionTrend.mockReturnValue({
    data: { thisMonth: 5, lastMonth: 3, trend: "up" },
    isPending: false,
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders header and health card grid", () => {
    mockAuditList.mockReturnValue(loadingState());

    render(<OpsDashboard />);

    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("System health at a glance")).toBeInTheDocument();
    // Health cards should be present (use getAllByText since labels repeat in quick links)
    expect(screen.getByText("Queues")).toBeInTheDocument();
    expect(screen.getByText("Submissions")).toBeInTheDocument();
  });

  it("renders quick links section", () => {
    mockAuditList.mockReturnValue(loadingState());

    render(<OpsDashboard />);

    expect(screen.getByText("Quick Links")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();

    // Check links point to correct destinations
    const orgLink = screen.getByText("Organization").closest("a");
    expect(orgLink?.getAttribute("href")).toBe("/organizations/settings");

    // Federation appears in both health card and quick link — verify quick link href
    const fedLinks = screen.getAllByText("Federation");
    const quickLinkFed = fedLinks
      .map((el) => el.closest("a"))
      .find((a) => a?.getAttribute("href") === "/federation");
    expect(quickLinkFed).toBeTruthy();
  });

  it("renders recent audit events", () => {
    mockAuditList.mockReturnValue({
      data: {
        items: [
          {
            id: "evt-1",
            action: "USER_CREATED",
            resource: "user",
            resourceId: "u0000000-0000-4000-a000-000000000001",
            createdAt: new Date("2026-03-27T10:30:00Z"),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
      isPending: false,
      error: null,
    });

    render(<OpsDashboard />);

    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("USER_CREATED")).toBeInTheDocument();
  });

  it("shows empty state when no audit events", () => {
    mockAuditList.mockReturnValue({
      data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      isPending: false,
      error: null,
    });

    render(<OpsDashboard />);

    expect(screen.getByText("No recent activity.")).toBeInTheDocument();
  });
});
