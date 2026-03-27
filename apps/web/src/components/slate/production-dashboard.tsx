"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { BookCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ProductionStatsCards } from "./production-stats-cards";
import { ProductionIssueSelector } from "./production-issue-selector";
import { ProductionPipelineTable } from "./production-pipeline-table";

export function ProductionDashboard() {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const handleIssueSelect = useCallback((id: string) => {
    setSelectedIssueId(id);
  }, []);

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.pipeline.dashboard.useQuery(
    { issueId: selectedIssueId ?? undefined },
    { enabled: selectedIssueId !== null },
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Production</h1>
          <p className="text-sm text-muted-foreground">
            Issue-centric pipeline overview
          </p>
        </div>
        <ProductionIssueSelector
          selectedIssueId={selectedIssueId}
          onSelect={handleIssueSelect}
        />
      </div>

      {isLoading && (
        <>
          <ProductionStatsCards
            summary={{
              total: 0,
              onTrack: 0,
              atRisk: 0,
              overdue: 0,
              waiting: 0,
            }}
            isLoading
          />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive py-4">
          Failed to load dashboard: {error.message}
        </p>
      )}

      {!isLoading && !error && data === null && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookCopy className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No active issues found. Create an issue to see the production
            dashboard.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/slate/issues/new">Create Issue</Link>
          </Button>
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <ProductionStatsCards summary={data.summary} />
          <ProductionPipelineTable items={data.items} />
        </>
      )}
    </div>
  );
}
