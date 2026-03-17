"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { STATUS_COLORS } from "./chart-colors";
import type { AnalyticsFilter } from "@colophony/types";

interface StatusBreakdownChartProps {
  filter: AnalyticsFilter;
}

export function StatusBreakdownChart({ filter }: StatusBreakdownChartProps) {
  const { data, isPending: isLoading } =
    trpc.submissions.analyticsStatusBreakdown.useQuery(filter);

  return (
    <Card data-testid="chart-card-status-breakdown">
      <CardHeader>
        <CardTitle className="text-base">Status Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data?.breakdown ?? []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name ?? ""}: ${value}`}
              >
                {data?.breakdown.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? "#6B7280"}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
