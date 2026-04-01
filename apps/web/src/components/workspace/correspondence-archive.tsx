"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function CorrespondenceArchive() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.correspondence.listByUser.useQuery({ page, limit });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Failed to load correspondence: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Correspondence</h1>
        <p className="text-muted-foreground">
          Decision letters, revision requests, and other messages related to
          your submissions.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Arrows indicate direction: ↙ received, ↗ sent by you.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No correspondence</h3>
          <p className="text-muted-foreground">
            When editors respond to your Colophony submissions, their messages
            will appear here.
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="space-y-2">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                {/* Direction icon */}
                <div className="mt-0.5">
                  {item.direction === "inbound" ? (
                    <ArrowDownLeft className="h-4 w-4 text-status-info" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-status-success" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {item.subject && (
                      <span className="font-medium text-sm truncate">
                        {item.subject}
                      </span>
                    )}
                    {item.journalName && (
                      <span className="text-xs text-muted-foreground">
                        {item.journalName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.bodyPreview}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.senderName && <span>{item.senderName}</span>}
                    <span>
                      {formatDistanceToNow(new Date(item.sentAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {item.source === "colophony" && (
                      <span className="text-status-info">via Colophony</span>
                    )}
                  </div>
                </div>
              </div>
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
