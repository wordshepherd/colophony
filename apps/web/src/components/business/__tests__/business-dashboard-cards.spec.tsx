import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const mockContributorsList = vi.fn();
const mockPaymentSummary = vi.fn();
const mockUpcomingReversions = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    contributors: {
      list: {
        useQuery: (...args: unknown[]) => mockContributorsList(...args),
      },
    },
    paymentTransactions: {
      summary: {
        useQuery: (...args: unknown[]) => mockPaymentSummary(...args),
      },
    },
    rightsAgreements: {
      upcomingReversions: {
        useQuery: (...args: unknown[]) => mockUpcomingReversions(...args),
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

import { BusinessDashboardCards } from "../business-dashboard-cards";
import {
  deriveContributorStatus,
  deriveOutstandingPaymentsStatus,
  deriveReversionStatus,
  deriveRevenueStatus,
} from "../business-dashboard-cards";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadingState() {
  return { data: undefined, isPending: true, isError: false, error: null };
}

function loaded<T>(data: T) {
  return { data, isPending: false, isError: false, error: null };
}

function errored() {
  return {
    data: undefined,
    isPending: false,
    isError: true,
    error: new Error("fail"),
  };
}

// ---------------------------------------------------------------------------
// Unit tests: status derivation helpers
// ---------------------------------------------------------------------------

describe("deriveContributorStatus", () => {
  it("returns loading when undefined", () => {
    expect(deriveContributorStatus(undefined).status).toBe("loading");
  });

  it("returns healthy with count", () => {
    const result = deriveContributorStatus(42);
    expect(result.status).toBe("healthy");
    expect(result.metric).toBe("42");
  });

  it("returns healthy even when 0", () => {
    expect(deriveContributorStatus(0).status).toBe("healthy");
  });
});

describe("deriveOutstandingPaymentsStatus", () => {
  it("returns loading when undefined", () => {
    expect(deriveOutstandingPaymentsStatus(undefined).status).toBe("loading");
  });

  it("returns healthy when no outstanding", () => {
    const result = deriveOutstandingPaymentsStatus({ SUCCEEDED: 10 });
    expect(result.status).toBe("healthy");
    expect(result.metric).toBe("0");
    expect(result.subtitle).toBe("All settled");
  });

  it("returns degraded for 1-5 outstanding", () => {
    const result = deriveOutstandingPaymentsStatus({
      PENDING: 2,
      PROCESSING: 1,
    });
    expect(result.status).toBe("degraded");
    expect(result.metric).toBe("3");
  });

  it("returns unhealthy for >5 outstanding", () => {
    const result = deriveOutstandingPaymentsStatus({
      PENDING: 4,
      PROCESSING: 3,
    });
    expect(result.status).toBe("unhealthy");
    expect(result.metric).toBe("7");
  });

  it("handles missing PENDING/PROCESSING keys without NaN", () => {
    const result = deriveOutstandingPaymentsStatus({});
    expect(result.status).toBe("healthy");
    expect(result.metric).toBe("0");
  });
});

describe("deriveReversionStatus", () => {
  it("returns loading when undefined", () => {
    expect(deriveReversionStatus(undefined).status).toBe("loading");
  });

  it("returns healthy when 0", () => {
    const result = deriveReversionStatus(0);
    expect(result.status).toBe("healthy");
    expect(result.subtitle).toBe("None due");
  });

  it("returns degraded for 1-3", () => {
    expect(deriveReversionStatus(1).status).toBe("degraded");
    expect(deriveReversionStatus(3).status).toBe("degraded");
  });

  it("returns unhealthy for >3", () => {
    expect(deriveReversionStatus(4).status).toBe("unhealthy");
  });
});

describe("deriveRevenueStatus", () => {
  it("returns loading when undefined", () => {
    expect(deriveRevenueStatus(undefined).status).toBe("loading");
  });

  it("returns healthy for positive net", () => {
    const result = deriveRevenueStatus(150000);
    expect(result.status).toBe("healthy");
    expect(result.metric).toBe("$1,500.00");
  });

  it("returns healthy for zero net", () => {
    expect(deriveRevenueStatus(0).status).toBe("healthy");
  });

  it("returns unhealthy for negative net", () => {
    const result = deriveRevenueStatus(-5000);
    expect(result.status).toBe("unhealthy");
    expect(result.metric).toBe("-$50.00");
  });
});

// ---------------------------------------------------------------------------
// Component tests
// ---------------------------------------------------------------------------

describe("BusinessDashboardCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four health cards with loaded data", () => {
    mockContributorsList.mockReturnValue(
      loaded({ items: [], total: 12, page: 1, limit: 1, totalPages: 12 }),
    );
    mockPaymentSummary.mockReturnValue(
      loaded({
        totalInbound: 500000,
        totalOutbound: 200000,
        net: 300000,
        countByType: { submission_fee: 10 },
        countByStatus: { SUCCEEDED: 8, PENDING: 2 },
      }),
    );
    mockUpcomingReversions.mockReturnValue(loaded([{ id: "1" }, { id: "2" }]));

    render(<BusinessDashboardCards />);

    expect(screen.getByText("Contributors")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Payments")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Reversions")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();

    // Verify metrics
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByText("Pending + processing")).toBeInTheDocument();
    expect(screen.getByText("Within 30 days")).toBeInTheDocument();
  });

  it("shows loading state while queries pending", () => {
    mockContributorsList.mockReturnValue(loadingState());
    mockPaymentSummary.mockReturnValue(loadingState());
    mockUpcomingReversions.mockReturnValue(loadingState());

    const { container } = render(<BusinessDashboardCards />);

    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state when queries fail", () => {
    mockContributorsList.mockReturnValue(errored());
    mockPaymentSummary.mockReturnValue(errored());
    mockUpcomingReversions.mockReturnValue(errored());

    render(<BusinessDashboardCards />);

    const failedMessages = screen.getAllByText("Failed to load");
    expect(failedMessages).toHaveLength(4);
  });

  it("links cards to correct pages", () => {
    mockContributorsList.mockReturnValue(
      loaded({ items: [], total: 0, page: 1, limit: 1, totalPages: 0 }),
    );
    mockPaymentSummary.mockReturnValue(
      loaded({
        totalInbound: 0,
        totalOutbound: 0,
        net: 0,
        countByType: {},
        countByStatus: {},
      }),
    );
    mockUpcomingReversions.mockReturnValue(loaded([]));

    render(<BusinessDashboardCards />);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/business/contributors");
    expect(hrefs).toContain("/business/payments");
    expect(hrefs).toContain("/business/rights");
  });
});
