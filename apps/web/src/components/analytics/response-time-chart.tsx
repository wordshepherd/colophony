"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { AnalyticsFilter } from "@colophony/types";

interface ResponseTimeChartProps {
  filter: AnalyticsFilter;
}

export function ResponseTimeChart({ filter }: ResponseTimeChartProps) {
  const { data, isPending: isLoading } =
    trpc.submissions.analyticsResponseTime.useQuery(filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Response Time Distribution
          {data?.medianDays != null && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Median: {data.medianDays.toFixed(1)}d
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.buckets ?? []}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              {data?.medianDays != null && (
                <ReferenceLine
                  x={
                    data.buckets.find(
                      (b) =>
                        data.medianDays! >= b.minDays &&
                        data.medianDays! < b.maxDays,
                    )?.label
                  }
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{ value: "Median", fill: "#EF4444", fontSize: 12 }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
