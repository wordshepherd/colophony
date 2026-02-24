"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { PipelineStageBadge } from "./pipeline-stage-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch, X } from "lucide-react";
import type { PipelineStage } from "@colophony/types";

const STAGE_TABS: Array<{ value: PipelineStage | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "COPYEDIT_PENDING", label: "Pending" },
  { value: "COPYEDIT_IN_PROGRESS", label: "Copyediting" },
  { value: "AUTHOR_REVIEW", label: "Author Review" },
  { value: "PROOFREAD", label: "Proofreading" },
  { value: "READY_TO_PUBLISH", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export function PipelineList() {
  const [stageFilter, setStageFilter] = useState<PipelineStage | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, error } = trpc.pipeline.list.useQuery({
    stage: stageFilter === "ALL" ? undefined : stageFilter,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });

  // Clamp page when data shrinks (render-time state adjustment)
  if (data && data.totalPages > 0 && page > data.totalPages) {
    setPage(data.totalPages);
  }

  const handleStageChange = (value: string) => {
    setStageFilter(value as PipelineStage | "ALL");
    setPage(1);
  };

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <p className="text-destructive">
          Failed to load pipeline items: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pipeline</h1>

      {/* Search */}
      <div className="relative max-w-sm">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Stage tabs */}
      <Tabs value={stageFilter} onValueChange={handleStageChange}>
        <TabsList>
          {STAGE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table or empty state */}
      {data && data.items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Publication</TableHead>
                <TableHead>Copyeditor</TableHead>
                <TableHead>Proofreader</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <PipelineStageBadge stage={item.stage} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/slate/pipeline/${item.id}`}
                      className="text-sm hover:underline"
                    >
                      {item.submission?.title ??
                        item.submissionId.slice(0, 8) + "\u2026"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.publication?.name ??
                      (item.publicationId
                        ? item.publicationId.slice(0, 8) + "\u2026"
                        : "\u2014")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.assignedCopyeditor?.email ??
                      (item.assignedCopyeditorId
                        ? item.assignedCopyeditorId.slice(0, 8) + "\u2026"
                        : "\u2014")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.assignedProofreader?.email ??
                      (item.assignedProofreaderId
                        ? item.assignedProofreaderId.slice(0, 8) + "\u2026"
                        : "\u2014")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(item.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No pipeline items</p>
          <p className="text-sm text-muted-foreground mt-1">
            {stageFilter !== "ALL"
              ? "No items in this stage."
              : debouncedSearch
                ? "No items match your search."
                : "Items will appear here when submissions are sent to the pipeline."}
          </p>
        </div>
      )}
    </div>
  );
}
