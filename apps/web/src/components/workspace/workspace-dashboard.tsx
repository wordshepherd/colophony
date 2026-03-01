"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { WorkspaceStatsCards } from "./workspace-stats-cards";
import { Plus, Send, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function WorkspaceDashboard() {
  const {
    data: stats,
    isPending: isLoading,
    error,
  } = trpc.workspace.stats.useQuery();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Writer Workspace</h1>
          <p className="text-muted-foreground">
            Track your manuscripts, submissions, and correspondence
          </p>
        </div>
        <Link href="/workspace/external/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Track Submission
          </Button>
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">
            Failed to load workspace stats: {error.message}
          </p>
        </div>
      )}

      {/* Stats cards */}
      <WorkspaceStatsCards stats={stats} isLoading={isLoading} />

      {/* Acceptance rate */}
      {stats?.acceptanceRate != null && (
        <div className="text-sm text-muted-foreground">
          Acceptance rate:{" "}
          <span className="font-medium text-foreground">
            {(stats.acceptanceRate * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Recent activity */}
      {stats && stats.recentActivity.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <div className="space-y-2">
            {stats.recentActivity.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                {item.type === "external_submission" ? (
                  <Send className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Mail className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{item.label}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(item.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href="/workspace/external">
          <Button variant="outline">
            <Send className="mr-2 h-4 w-4" />
            View External Submissions
          </Button>
        </Link>
        <Link href="/workspace/correspondence">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            View Correspondence
          </Button>
        </Link>
      </div>
    </div>
  );
}
