"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionCard } from "./submission-card";
import { Plus, FileText } from "lucide-react";
import type { SubmissionStatus } from "@colophony/types";

const statusTabs: Array<{ value: SubmissionStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];

export function SubmissionList() {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const limit = 10;

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.submissions.mySubmissions.useQuery({
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Submissions</h1>
          <p className="text-muted-foreground">
            Manage and track your submissions
          </p>
        </div>
        <Link href="/submissions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Submission
          </Button>
        </Link>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
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
              ? "You haven't created any submissions yet."
              : `You don't have any ${statusFilter.toLowerCase().replace("_", " ")} submissions.`}
          </p>
          {statusFilter === "ALL" && (
            <Link href="/submissions/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create your first submission
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Submissions grid */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
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
