"use client";

import { Percent, Clock, GitBranch, Users } from "lucide-react";
import {
  HealthCard,
  type HealthStatus,
} from "@/components/operations/health-card";
import type { EditorialAnalyticsFilter } from "@colophony/types";
import { trpc } from "@/lib/trpc";

interface EditorialOverviewCardsProps {
  filter: EditorialAnalyticsFilter;
}

export function EditorialOverviewCards({
  filter,
}: EditorialOverviewCardsProps) {
  const { data: genreData, isPending: genreLoading } =
    trpc.editorialAnalytics.acceptanceByGenre.useQuery(filter);
  const { data: responseData, isPending: responseLoading } =
    trpc.editorialAnalytics.responseTimeStats.useQuery(filter);
  const { data: pipelineData, isPending: pipelineLoading } =
    trpc.editorialAnalytics.pipelineHealth.useQuery(filter);
  const { data: alignmentData, isPending: alignmentLoading } =
    trpc.editorialAnalytics.readerAlignment.useQuery(filter);

  // Derive acceptance rate from genre aggregates
  const totalAccepted =
    genreData?.genres.reduce((sum, g) => sum + g.accepted, 0) ?? 0;
  const totalDecisions =
    genreData?.genres.reduce((sum, g) => sum + g.accepted + g.rejected, 0) ?? 0;
  const overallRate =
    totalDecisions > 0
      ? Math.round((totalAccepted / totalDecisions) * 1000) / 10
      : 0;

  // Derive pipeline total and stuck
  const pipelineTotal =
    pipelineData?.stages.reduce((sum, s) => sum + s.count, 0) ?? 0;
  const pipelineStuck =
    pipelineData?.stages.reduce((sum, s) => sum + s.stuckCount, 0) ?? 0;

  function deriveAcceptanceStatus(): HealthStatus {
    if (genreLoading) return "loading";
    if (totalDecisions === 0) return "unknown";
    return "healthy";
  }

  function deriveResponseStatus(): HealthStatus {
    if (responseLoading) return "loading";
    if (responseData?.medianDays == null) return "unknown";
    if (responseData.medianDays > 60) return "unhealthy";
    if (responseData.medianDays > 30) return "degraded";
    return "healthy";
  }

  function derivePipelineStatus(): HealthStatus {
    if (pipelineLoading) return "loading";
    if (pipelineTotal === 0) return "unknown";
    if (pipelineStuck > 5) return "unhealthy";
    if (pipelineStuck > 0) return "degraded";
    return "healthy";
  }

  function deriveAlignmentStatus(): HealthStatus {
    if (alignmentLoading) return "loading";
    if ((alignmentData?.totalWithVotes ?? 0) === 0) return "unknown";
    if ((alignmentData?.consensusRate ?? 0) < 50) return "degraded";
    return "healthy";
  }

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <HealthCard
        title="Acceptance Rate"
        status={deriveAcceptanceStatus()}
        metric={`${overallRate}%`}
        subtitle={`${totalDecisions} decisions`}
        icon={Percent}
      />
      <HealthCard
        title="Median Response"
        status={deriveResponseStatus()}
        metric={
          responseData?.medianDays != null
            ? `${Math.round(responseData.medianDays)}d`
            : "—"
        }
        subtitle={
          responseData?.p90Days != null
            ? `p90: ${Math.round(responseData.p90Days)}d`
            : undefined
        }
        icon={Clock}
      />
      <HealthCard
        title="Pipeline Items"
        status={derivePipelineStatus()}
        metric={`${pipelineTotal}`}
        subtitle={pipelineStuck > 0 ? `${pipelineStuck} stuck` : "All moving"}
        icon={GitBranch}
      />
      <HealthCard
        title="Vote Consensus"
        status={deriveAlignmentStatus()}
        metric={
          alignmentData?.totalWithVotes
            ? `${alignmentData.consensusRate}%`
            : "—"
        }
        subtitle={
          alignmentData?.totalWithVotes
            ? `${alignmentData.totalWithVotes} voted`
            : undefined
        }
        icon={Users}
      />
    </div>
  );
}
