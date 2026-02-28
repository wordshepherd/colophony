"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { STATUS_COLORS } from "./chart-colors";
import type { AnalyticsFilter } from "@colophony/types";

interface FunnelChartProps {
  filter: AnalyticsFilter;
}

export function FunnelChart({ filter }: FunnelChartProps) {
  const { data, isPending: isLoading } =
    trpc.submissions.analyticsFunnel.useQuery(filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submission Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data?.stages ?? []}
              layout="vertical"
              margin={{ left: 80 }}
            >
              <XAxis type="number" />
              <YAxis type="category" dataKey="stage" width={120} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data?.stages.map((entry) => (
                  <Cell
                    key={entry.stage}
                    fill={STATUS_COLORS[entry.stage] ?? "#3B82F6"}
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
