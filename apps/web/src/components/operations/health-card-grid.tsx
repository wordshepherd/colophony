"use client";

import { useState } from "react";
import { Network, ListTodo, Webhook, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { HealthCard, type HealthStatus } from "./health-card";
import { QueueHealthDetail } from "./queue-health-detail";

// ---------------------------------------------------------------------------
// Status derivation helpers
// ---------------------------------------------------------------------------

function deriveFederationStatus(peers: Array<{ status: string }> | undefined): {
  status: HealthStatus;
  metric: string;
  subtitle?: string;
} {
  if (!peers) return { status: "loading", metric: "" };

  const active = peers.filter((p) => p.status === "active").length;
  const pending = peers.filter(
    (p) => p.status === "pending_inbound" || p.status === "pending_outbound",
  ).length;
  const troubled = peers.filter(
    (p) => p.status === "rejected" || p.status === "revoked",
  ).length;

  let status: HealthStatus = "healthy";
  if (troubled > 0) status = "unhealthy";
  else if (pending > 0) status = "degraded";

  return {
    status,
    metric: `${active} active`,
    subtitle:
      pending > 0
        ? `${pending} pending`
        : troubled > 0
          ? `${troubled} revoked/rejected`
          : undefined,
  };
}

function deriveQueueStatus(
  queues:
    | Array<{
        name: string;
        waiting: number;
        active: number;
        delayed: number;
        failed: number;
      }>
    | undefined,
): { status: HealthStatus; metric: string; subtitle?: string } {
  if (!queues) return { status: "loading", metric: "" };

  const totalWaiting = queues.reduce((sum, q) => sum + q.waiting, 0);
  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);

  let status: HealthStatus = "healthy";
  if (totalFailed > 10) status = "unhealthy";
  else if (totalFailed > 0 || totalWaiting >= 50) status = "degraded";

  return {
    status,
    metric: `${totalWaiting} waiting`,
    subtitle: totalFailed > 0 ? `${totalFailed} failed` : undefined,
  };
}

function deriveWebhookStatus(
  providers:
    | Array<{ provider: string; status: string; lastReceivedAt: string | null }>
    | undefined,
): { status: HealthStatus; metric: string; subtitle?: string } {
  if (!providers) return { status: "loading", metric: "" };

  const healthy = providers.filter((p) => p.status === "healthy").length;
  const stale = providers.filter((p) => p.status === "stale");
  const unknown = providers.filter(
    (p) => p.status === "unknown" && !p.lastReceivedAt,
  );

  let status: HealthStatus = "healthy";
  if (unknown.length > 0) status = "unhealthy";
  else if (stale.length > 0) status = "degraded";

  const staleNames = stale.map((p) => p.provider).join(", ");

  return {
    status,
    metric: `${healthy}/${providers.length} healthy`,
    subtitle: staleNames ? `Stale: ${staleNames}` : undefined,
  };
}

function deriveSubmissionStatus(
  data: { thisMonth: number; lastMonth: number; trend: string } | undefined,
): { status: HealthStatus; metric: string; subtitle?: string } {
  if (!data) return { status: "loading", metric: "" };

  let subtitle: string | undefined;
  if (data.lastMonth > 0) {
    const pct = Math.round(
      ((data.thisMonth - data.lastMonth) / data.lastMonth) * 100,
    );
    const sign = pct >= 0 ? "+" : "";
    subtitle = `${sign}${pct}% vs last month`;
  } else if (data.thisMonth > 0) {
    subtitle = "New this month";
  }

  return {
    status: "healthy",
    metric: `${data.thisMonth} this month`,
    subtitle,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const REFETCH_INTERVAL = 60_000;

export function HealthCardGrid() {
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);

  const { data: peers, isPending: isPeersLoading } =
    trpc.federation.listPeers.useQuery(undefined, {
      refetchInterval: REFETCH_INTERVAL,
    });

  const { data: queueHealth, isPending: isQueuesLoading } =
    trpc.ops.queueHealth.useQuery(undefined, {
      refetchInterval: REFETCH_INTERVAL,
    });

  const { data: webhookHealth, isPending: isWebhooksLoading } =
    trpc.ops.webhookProviderHealth.useQuery(undefined, {
      refetchInterval: REFETCH_INTERVAL,
    });

  const { data: submissionTrend, isPending: isSubsLoading } =
    trpc.ops.submissionTrend.useQuery(undefined, {
      refetchInterval: REFETCH_INTERVAL,
    });

  const federation = deriveFederationStatus(isPeersLoading ? undefined : peers);
  const queues = deriveQueueStatus(
    isQueuesLoading ? undefined : queueHealth?.queues,
  );
  const webhooks = deriveWebhookStatus(
    isWebhooksLoading ? undefined : webhookHealth?.providers,
  );
  const subs = deriveSubmissionStatus(
    isSubsLoading ? undefined : submissionTrend,
  );

  return (
    <>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <HealthCard
          title="Federation"
          icon={Network}
          href="/federation"
          {...federation}
        />
        <HealthCard
          title="Queues"
          icon={ListTodo}
          onClick={() => setQueueDialogOpen(true)}
          {...queues}
        />
        <HealthCard
          title="Webhooks"
          icon={Webhook}
          href="/webhooks"
          {...webhooks}
        />
        <HealthCard
          title="Submissions"
          icon={FileText}
          href="/editor/submissions"
          {...subs}
        />
      </div>

      {queueHealth?.queues && (
        <QueueHealthDetail
          open={queueDialogOpen}
          onOpenChange={setQueueDialogOpen}
          queues={queueHealth.queues}
        />
      )}
    </>
  );
}
