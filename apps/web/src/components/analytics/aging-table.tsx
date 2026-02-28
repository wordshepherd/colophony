"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { STATUS_COLORS } from "./chart-colors";
import type { AnalyticsFilter } from "@colophony/types";

interface AgingTableProps {
  filter: AnalyticsFilter;
}

export function AgingTable({ filter }: AgingTableProps) {
  const { data, isPending: isLoading } =
    trpc.submissions.analyticsAging.useQuery({
      ...filter,
      thresholdDays: 14,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Aging Submissions
          {data && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {data.totalAging} total
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : data?.totalAging === 0 ? (
          <p className="text-sm text-muted-foreground">
            No aging submissions found.
          </p>
        ) : (
          <div className="space-y-4">
            {data?.brackets
              .filter((b) => b.count > 0)
              .map((bracket) => (
                <div key={bracket.label}>
                  <h4 className="text-sm font-medium mb-2">
                    {bracket.label}{" "}
                    <span className="text-muted-foreground">
                      ({bracket.count})
                    </span>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                          Days Pending
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bracket.submissions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">
                            {sub.title ?? "Untitled"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: `${STATUS_COLORS[sub.status] ?? "#6B7280"}20`,
                                color: STATUS_COLORS[sub.status] ?? "#6B7280",
                              }}
                            >
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {sub.daysPending}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
