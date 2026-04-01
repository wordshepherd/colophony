"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Send, CheckCircle, XCircle } from "lucide-react";
import type { WorkspaceStats } from "@colophony/types";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface WorkspaceStatsCardsProps {
  stats: WorkspaceStats | undefined;
  isLoading: boolean;
}

const cards = [
  {
    title: "Manuscripts",
    key: "manuscriptCount" as const,
    icon: BookOpen,
    tooltip: "Pieces of writing you've created or uploaded.",
  },
  {
    title: "Pending",
    key: "pendingSubmissions" as const,
    icon: Send,
    tooltip: "Submissions currently awaiting a decision from editors.",
  },
  {
    title: "Accepted",
    key: "acceptedSubmissions" as const,
    icon: CheckCircle,
    tooltip: "Submissions accepted for publication.",
  },
  {
    title: "Rejected",
    key: "rejectedSubmissions" as const,
    icon: XCircle,
    tooltip: "Submissions that were declined.",
  },
];

export function WorkspaceStatsCards({
  stats,
  isLoading,
}: WorkspaceStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                {c.title}
                <InfoTooltip content={c.tooltip} />
              </CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
              {c.title}
              <InfoTooltip content={c.tooltip} />
            </CardTitle>
            <c.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.[c.key] ?? 0}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
