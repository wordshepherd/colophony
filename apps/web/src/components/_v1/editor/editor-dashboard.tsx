"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/submissions/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, FileText } from "lucide-react";
import type { SubmissionStatus } from "@colophony/types";

const statusTabs: Array<{ value: SubmissionStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "HOLD", label: "On Hold" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];

export function EditorDashboard() {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "ALL">(
    "SUBMITTED",
  );
  const [page, setPage] = useState(1);
  const limit = 20;

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.submissions.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    limit,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Failed to load submissions: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Editor Dashboard</h1>
        <p className="text-muted-foreground">Review and manage submissions</p>
      </div>

      {/* Status filter tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v as SubmissionStatus | "ALL");
          setPage(1);
        }}
      >
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No submissions</h3>
          <p className="text-muted-foreground">
            {statusFilter === "ALL"
              ? "There are no submissions in this organization."
              : `There are no ${statusFilter.toLowerCase().replace("_", " ")} submissions.`}
          </p>
        </div>
      )}

      {/* Submissions table */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/editor/${submission.id}`}
                        className="hover:underline"
                      >
                        {submission.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission.submitter?.email ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={submission.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission.submittedAt
                        ? formatDistanceToNow(
                            new Date(submission.submittedAt),
                            {
                              addSuffix: true,
                            },
                          )
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/editor/${submission.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
