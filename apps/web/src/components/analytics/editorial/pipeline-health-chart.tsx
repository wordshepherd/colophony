"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface PipelineHealthChartProps {
  filter: EditorialAnalyticsFilter;
}

const STAGE_COLORS: Record<string, string> = {
  COPYEDIT_PENDING: "#3B82F6",
  COPYEDIT_IN_PROGRESS: "#6366F1",
  AUTHOR_REVIEW: "#F59E0B",
  PROOFREAD: "#10B981",
  READY_TO_PUBLISH: "#22C55E",
};

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PipelineHealthChart({ filter }: PipelineHealthChartProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.pipelineHealth.useQuery(filter);

  const chartData = (data?.stages ?? []).map((s) => ({
    ...s,
    label: formatStage(s.stage),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline Health</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No pipeline items
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded border bg-background p-2 text-xs shadow-sm">
                      <p className="font-medium">{d.label}</p>
                      <p>Count: {d.count}</p>
                      <p>
                        Avg days:{" "}
                        {d.avgDaysInStage != null
                          ? Math.round(d.avgDaysInStage)
                          : "—"}
                      </p>
                      <p
                        className={
                          d.stuckCount > 0
                            ? "text-status-error font-medium"
                            : ""
                        }
                      >
                        Stuck (&gt;14d): {d.stuckCount}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" name="Items">
                {chartData.map((entry) => (
                  <Cell
                    key={entry.stage}
                    fill={
                      entry.stuckCount > 0
                        ? "#EF4444"
                        : (STAGE_COLORS[entry.stage] ?? "#6B7280")
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
