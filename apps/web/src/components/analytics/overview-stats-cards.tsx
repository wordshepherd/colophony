"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { AnalyticsFilter } from "@colophony/types";

interface OverviewStatsCardsProps {
  filter?: AnalyticsFilter;
}

export function OverviewStatsCards({ filter = {} }: OverviewStatsCardsProps) {
  const { data, isPending: isLoading } =
    trpc.submissions.analyticsOverview.useQuery(filter);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const trend =
    data.submissionsLastMonth > 0
      ? Math.round(
          ((data.submissionsThisMonth - data.submissionsLastMonth) /
            data.submissionsLastMonth) *
            100,
        )
      : null;

  const cards = [
    {
      title: "Total Submissions",
      value: data.totalSubmissions.toLocaleString(),
    },
    {
      title: "Acceptance Rate",
      value: `${data.acceptanceRate.toFixed(1)}%`,
    },
    {
      title: "Avg Response Time",
      value: data.avgResponseTimeDays
        ? `${data.avgResponseTimeDays.toFixed(1)}d`
        : "N/A",
    },
    {
      title: "Pending",
      value: data.pendingCount.toLocaleString(),
    },
    {
      title: "This Month",
      value: data.submissionsThisMonth.toLocaleString(),
      subtitle:
        trend !== null
          ? `${trend >= 0 ? "+" : ""}${trend}% vs last month`
          : undefined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {card.subtitle}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
