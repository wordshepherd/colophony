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
import { CSR_STATUS_COLORS } from "@/components/analytics/chart-colors";
import type { WriterAnalyticsFilter } from "@colophony/types";

interface WriterStatusChartProps {
  filter: WriterAnalyticsFilter;
}

export function WriterStatusChart({ filter }: WriterStatusChartProps) {
  const { data, isPending: isLoading } =
    trpc.workspace.analyticsStatusBreakdown.useQuery(filter);

  return (
    <Card>
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
                    fill={CSR_STATUS_COLORS[entry.status] ?? "#6B7280"}
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
