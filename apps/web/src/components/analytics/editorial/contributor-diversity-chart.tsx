"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { GENRE_COLORS } from "../chart-colors";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface ContributorDiversityChartProps {
  filter: EditorialAnalyticsFilter;
}

function formatGenre(genre: string): string {
  return genre.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ContributorDiversityChart({
  filter,
}: ContributorDiversityChartProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.contributorDiversity.useQuery(filter);

  const barData = data?.newVsReturning ?? [];
  const pieData = (data?.genreSpread ?? []).map((g) => ({
    ...g,
    name: formatGenre(g.genre),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submitter Diversity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : barData.length === 0 && pieData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No diversity data available
          </p>
        ) : (
          <div className="space-y-6">
            {barData.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  New vs Returning Submitters by Period
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="periodName"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="newCount"
                      name="New"
                      fill="#3B82F6"
                      stackId="submitters"
                    />
                    <Bar
                      dataKey="returningCount"
                      name="Returning"
                      fill="#22C55E"
                      stackId="submitters"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {pieData.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Genre Spread of Accepted Submitters
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={({ name, value }) => `${name ?? ""}: ${value}`}
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.genre}
                          fill={GENRE_COLORS[entry.genre] ?? "#6B7280"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
