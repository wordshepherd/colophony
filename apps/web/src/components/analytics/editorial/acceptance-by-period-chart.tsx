"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface AcceptanceByPeriodChartProps {
  filter: EditorialAnalyticsFilter;
}

export function AcceptanceByPeriodChart({
  filter,
}: AcceptanceByPeriodChartProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.acceptanceByPeriod.useQuery(filter);

  const chartData = (data?.periods ?? []).map((p) => ({
    name: p.periodName,
    rate: p.rate,
    total: p.total,
    accepted: p.accepted,
    rejected: p.rejected,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acceptance Rate by Period</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No period data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "rate") return [`${value}%`, "Acceptance Rate"];
                  return [value, name];
                }}
              />
              <Bar dataKey="rate" fill="#3B82F6" name="rate" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
