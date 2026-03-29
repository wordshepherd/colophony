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
import { GENRE_COLORS } from "../chart-colors";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface GenreDistributionChartProps {
  filter: EditorialAnalyticsFilter;
}

function formatGenre(genre: string): string {
  return genre.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GenreDistributionChart({
  filter,
}: GenreDistributionChartProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.genreDistribution.useQuery(filter);

  const chartData = (data?.distribution ?? []).map((d) => ({
    ...d,
    name: formatGenre(d.genre),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Genre Distribution</CardTitle>
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
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name ?? ""}: ${value}`}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.genre}
                    fill={GENRE_COLORS[entry.genre] ?? "#6B7280"}
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
