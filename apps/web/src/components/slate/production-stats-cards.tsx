"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
interface Summary {
  total: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  waiting: number;
}

interface ProductionStatsCardsProps {
  summary: Summary;
  isLoading?: boolean;
}

const cards = [
  { key: "total" as const, label: "Total Pieces", color: "text-foreground" },
  {
    key: "onTrack" as const,
    label: "On Track",
    color: "text-status-success",
  },
  {
    key: "atRisk" as const,
    label: "At Risk",
    color: "text-status-warning",
  },
  {
    key: "overdue" as const,
    label: "Overdue",
    color: "text-status-error",
  },
  {
    key: "waiting" as const,
    label: "Waiting",
    color: "text-status-held",
  },
];

export function ProductionStatsCards({
  summary,
  isLoading,
}: ProductionStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="py-2 px-3">
              <Skeleton className="h-3 w-16" />
            </CardHeader>
            <CardContent className="py-1 px-3 pb-2">
              <Skeleton className="h-7 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-3 pb-2">
            <p className={`text-2xl font-bold ${card.color}`}>
              {summary[card.key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
