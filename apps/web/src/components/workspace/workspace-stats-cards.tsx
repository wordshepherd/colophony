"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Send, CheckCircle, XCircle } from "lucide-react";
import type { WorkspaceStats } from "@colophony/types";

interface WorkspaceStatsCardsProps {
  stats: WorkspaceStats | undefined;
  isLoading: boolean;
}

const cards = [
  {
    title: "Manuscripts",
    key: "manuscriptCount" as const,
    icon: BookOpen,
  },
  {
    title: "Pending",
    key: "pendingSubmissions" as const,
    icon: Send,
  },
  {
    title: "Accepted",
    key: "acceptedSubmissions" as const,
    icon: CheckCircle,
  },
  {
    title: "Rejected",
    key: "rejectedSubmissions" as const,
    icon: XCircle,
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
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
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
