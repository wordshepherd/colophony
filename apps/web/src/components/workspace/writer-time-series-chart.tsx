"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import type { WriterAnalyticsFilter } from "@colophony/types";

interface WriterTimeSeriesChartProps {
  filter: WriterAnalyticsFilter;
}

export function WriterTimeSeriesChart({ filter }: WriterTimeSeriesChartProps) {
  const [granularity, setGranularity] = useState<
    "daily" | "weekly" | "monthly"
  >("monthly");

  const { data, isPending: isLoading } =
    trpc.workspace.analyticsTimeSeries.useQuery({
      ...filter,
      granularity,
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Submissions Over Time</CardTitle>
        <Select
          value={granularity}
          onValueChange={(v) =>
            setGranularity(v as "daily" | "weekly" | "monthly")
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.points ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="nativeCount"
                name="Colophony"
                stackId="1"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="externalCount"
                name="External"
                stackId="1"
                stroke="#A855F7"
                fill="#A855F7"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
