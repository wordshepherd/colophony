"use client";

import type { PublicResponseTimeStats } from "@colophony/types";
import { Clock, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface ResponseTimeDisplayProps {
  stats: PublicResponseTimeStats | null;
}

function formatDays(days: number | null): string {
  if (days === null) return "N/A";
  if (days < 1) return "< 1 day";
  if (days < 7)
    return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `~${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  const months = Math.round(days / 30);
  return `~${months} month${months === 1 ? "" : "s"}`;
}

function TrendIndicator({
  trend,
}: {
  trend: PublicResponseTimeStats["trend"];
}) {
  if (trend.length < 2) return null;

  const recent = trend[trend.length - 1].medianDays;
  const previous = trend[trend.length - 2].medianDays;
  if (recent === null || previous === null) return null;

  const diff = recent - previous;
  if (Math.abs(diff) < 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        Steady
      </span>
    );
  }

  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <TrendingDown className="h-3 w-3" />
        Getting faster
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <TrendingUp className="h-3 w-3" />
      Getting slower
    </span>
  );
}

export function ResponseTimeDisplay({ stats }: ResponseTimeDisplayProps) {
  if (!stats) return null;

  const maxPercentage = Math.max(...stats.buckets.map((b) => b.percentage), 1);

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Response Times</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">
          {formatDays(stats.medianDays)}
        </span>
        <span className="text-sm text-muted-foreground">typical response</span>
        <TrendIndicator trend={stats.trend} />
      </div>

      <div className="space-y-1.5">
        {stats.buckets
          .filter((b) => b.count > 0)
          .map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-2 text-xs">
              <span className="w-24 text-muted-foreground shrink-0">
                {bucket.label}
              </span>
              <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-sm transition-all"
                  style={{
                    width: `${(bucket.percentage / maxPercentage) * 100}%`,
                  }}
                />
              </div>
              <span className="w-10 text-right text-muted-foreground tabular-nums">
                {bucket.percentage}%
              </span>
            </div>
          ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Based on {stats.sampleSize} decided submission
        {stats.sampleSize !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
