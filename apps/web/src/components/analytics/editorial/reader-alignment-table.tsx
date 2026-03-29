"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { EditorialAnalyticsFilter } from "@colophony/types";

interface ReaderAlignmentTableProps {
  filter: EditorialAnalyticsFilter;
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED" || status === "ACCEPT") return "default";
  if (status === "REJECTED" || status === "REJECT") return "destructive";
  return "secondary";
}

export function ReaderAlignmentTable({ filter }: ReaderAlignmentTableProps) {
  const { data, isPending: isLoading } =
    trpc.editorialAnalytics.readerAlignment.useQuery(filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reader Alignment</CardTitle>
        <CardDescription>
          {data
            ? `${data.consensusRate}% consensus — ${data.consensusMatches}/${data.totalWithVotes} voted submissions matched final decision (${data.totalDecided} total decided)`
            : "Vote consensus vs final decisions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !data || data.breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No voted submissions with decisions yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Majority Vote</th>
                  <th className="py-2 pr-4 font-medium">Final</th>
                  <th className="py-2 pr-4 font-medium text-right">Votes</th>
                  <th className="py-2 font-medium text-center">Match</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((row) => (
                  <tr key={row.submissionId} className="border-b last:border-0">
                    <td className="py-2 pr-4 max-w-[200px] truncate">
                      {row.title ?? "Untitled"}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={statusBadgeVariant(row.majorityVote)}>
                        {row.majorityVote}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={statusBadgeVariant(row.finalStatus)}>
                        {row.finalStatus}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">{row.voteCount}</td>
                    <td className="py-2 text-center">
                      {row.matched ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
