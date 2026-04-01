"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/info-tooltip";
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
  {
    key: "total" as const,
    label: "Total Pieces",
    color: "text-foreground",
    tooltip: null,
  },
  {
    key: "onTrack" as const,
    label: "On Track",
    color: "text-status-success",
    tooltip: "Pieces progressing on schedule with no blockers.",
  },
  {
    key: "atRisk" as const,
    label: "At Risk",
    color: "text-status-warning",
    tooltip: "Pieces that may miss their deadline if not addressed soon.",
  },
  {
    key: "overdue" as const,
    label: "Overdue",
    color: "text-status-error",
    tooltip: "Pieces past their target completion date.",
  },
  {
    key: "waiting" as const,
    label: "Waiting",
    color: "text-status-held",
    tooltip:
      "Pieces blocked on an external dependency (author revisions, rights clearance, etc.).",
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
            <CardTitle className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {card.label}
              {card.tooltip && <InfoTooltip content={card.tooltip} />}
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
