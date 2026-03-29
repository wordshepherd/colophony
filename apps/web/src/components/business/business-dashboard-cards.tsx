"use client";

import { Users, Clock, CalendarClock, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { HealthCard, type HealthStatus } from "../operations/health-card";

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCents(cents: number): string {
  return usdFormatter.format(cents / 100);
}

// ---------------------------------------------------------------------------
// Status derivation helpers
// ---------------------------------------------------------------------------

interface DerivedStatus {
  status: HealthStatus;
  metric: string;
  subtitle?: string;
}

export function deriveContributorStatus(
  total: number | undefined,
): DerivedStatus {
  if (total === undefined) return { status: "loading", metric: "" };
  return {
    status: "healthy",
    metric: String(total),
    subtitle: "Total in organization",
  };
}

export function deriveOutstandingPaymentsStatus(
  countByStatus: Record<string, number> | undefined,
): DerivedStatus {
  if (!countByStatus) return { status: "loading", metric: "" };

  const outstanding =
    (countByStatus.PENDING ?? 0) + (countByStatus.PROCESSING ?? 0);

  let status: HealthStatus = "healthy";
  if (outstanding > 5) status = "unhealthy";
  else if (outstanding > 0) status = "degraded";

  return {
    status,
    metric: String(outstanding),
    subtitle: outstanding === 0 ? "All settled" : "Pending + processing",
  };
}

export function deriveReversionStatus(
  reversionCount: number | undefined,
): DerivedStatus {
  if (reversionCount === undefined) return { status: "loading", metric: "" };

  let status: HealthStatus = "healthy";
  if (reversionCount > 3) status = "unhealthy";
  else if (reversionCount > 0) status = "degraded";

  return {
    status,
    metric: String(reversionCount),
    subtitle: reversionCount === 0 ? "None due" : "Within 30 days",
  };
}

export function deriveRevenueStatus(net: number | undefined): DerivedStatus {
  if (net === undefined) return { status: "loading", metric: "" };

  return {
    status: net >= 0 ? "healthy" : "unhealthy",
    metric: formatCents(net),
    subtitle: "Net (inbound \u2212 outbound)",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessDashboardCards() {
  const {
    data: contributorData,
    isPending: isContributorsLoading,
    isError: isContributorsError,
  } = trpc.contributors.list.useQuery({ page: 1, limit: 1 });

  const {
    data: summaryData,
    isPending: isSummaryLoading,
    isError: isSummaryError,
  } = trpc.paymentTransactions.summary.useQuery();

  const {
    data: reversions,
    isPending: isReversionsLoading,
    isError: isReversionsError,
  } = trpc.rightsAgreements.upcomingReversions.useQuery({ withinDays: 30 });

  const contributors = isContributorsError
    ? { status: "unknown" as const, metric: "--", subtitle: "Failed to load" }
    : deriveContributorStatus(
        isContributorsLoading ? undefined : contributorData?.total,
      );

  const payments = isSummaryError
    ? { status: "unknown" as const, metric: "--", subtitle: "Failed to load" }
    : deriveOutstandingPaymentsStatus(
        isSummaryLoading ? undefined : summaryData?.countByStatus,
      );

  const reversionStatus = isReversionsError
    ? { status: "unknown" as const, metric: "--", subtitle: "Failed to load" }
    : deriveReversionStatus(
        isReversionsLoading ? undefined : reversions?.length,
      );

  const revenue = isSummaryError
    ? { status: "unknown" as const, metric: "--", subtitle: "Failed to load" }
    : deriveRevenueStatus(isSummaryLoading ? undefined : summaryData?.net);

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <HealthCard
        title="Contributors"
        icon={Users}
        href="/business/contributors"
        {...contributors}
      />
      <HealthCard
        title="Outstanding Payments"
        icon={Clock}
        href="/business/payments"
        {...payments}
      />
      <HealthCard
        title="Upcoming Reversions"
        icon={CalendarClock}
        href="/business/rights"
        {...reversionStatus}
      />
      <HealthCard
        title="Revenue"
        icon={DollarSign}
        href="/business/payments"
        {...revenue}
      />
    </div>
  );
}
