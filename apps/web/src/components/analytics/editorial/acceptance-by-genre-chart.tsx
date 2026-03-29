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
import { GENRE_COLORS } from "../chart-colors";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface AcceptanceByGenreChartProps {
  filter: EditorialAnalyticsFilter;
}

function formatGenre(genre: string): string {
  return genre.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AcceptanceByGenreChart({
  filter,
}: AcceptanceByGenreChartProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.acceptanceByGenre.useQuery(filter);

  const chartData = (data?.genres ?? []).map((g) => ({
    ...g,
    label: formatGenre(g.genre),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acceptance Rate by Genre</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No genre data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis type="category" dataKey="label" width={90} />
              <Tooltip formatter={(value) => [`${value}%`, "Rate"]} />
              <Bar dataKey="rate" name="Acceptance Rate">
                {chartData.map((entry) => (
                  <Cell
                    key={entry.genre}
                    fill={GENRE_COLORS[entry.genre] ?? "#6B7280"}
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
