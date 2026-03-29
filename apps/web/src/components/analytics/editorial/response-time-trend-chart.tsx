"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface ResponseTimeTrendChartProps {
  filter: EditorialAnalyticsFilter;
}

export function ResponseTimeTrendChart({
  filter,
}: ResponseTimeTrendChartProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.responseTimeStats.useQuery(filter);

  const chartData = (data?.trend ?? []).map((t) => ({
    month: t.month,
    median: t.medianDays != null ? Math.round(t.medianDays * 10) / 10 : null,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Response Time Trend</CardTitle>
        <CardDescription>
          {data?.avgDays != null &&
            `Avg: ${Math.round(data.avgDays)}d | Median: ${data.medianDays != null ? Math.round(data.medianDays) : "—"}d | p90: ${data.p90Days != null ? Math.round(data.p90Days) : "—"}d`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No response time data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) => `${v}d`}
                label={{
                  value: "Days",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip formatter={(value) => [`${value} days`, "Median"]} />
              {data?.p90Days != null && (
                <ReferenceLine
                  y={Math.round(data.p90Days)}
                  stroke="#EF4444"
                  strokeDasharray="5 5"
                  label={{ value: "p90", fill: "#EF4444", fontSize: 11 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="median"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
