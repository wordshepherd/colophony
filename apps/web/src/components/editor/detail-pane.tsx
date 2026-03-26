"use client";

import { trpc } from "@/lib/trpc";
import { DensityProvider } from "@/hooks/use-density";
import { SubmissionDetail } from "@/components/submissions/submission-detail";
import { ManuscriptRenderer } from "@/components/manuscripts/manuscript-renderer";
import { textToProseMirrorDoc } from "@/lib/manuscript";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";
import { useState } from "react";

interface DetailPaneProps {
  submissionId: string | null;
  mode: "triage" | "deep-read";
}

/**
 * Right pane wrapper that renders submission detail (triage)
 * or ManuscriptRenderer (deep-read) based on mode.
 */
export function DetailPane({ submissionId, mode }: DetailPaneProps) {
  if (!submissionId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a submission to begin reading</p>
          <p className="text-xs mt-1">
            Use{" "}
            <kbd className="px-1 py-0.5 rounded border bg-muted text-xs">j</kbd>
            /
            <kbd className="px-1 py-0.5 rounded border bg-muted text-xs">k</kbd>{" "}
            to navigate
          </p>
        </div>
      </div>
    );
  }

  if (mode === "triage") {
    return (
      <div className="h-full overflow-y-auto p-4">
        <SubmissionDetail submissionId={submissionId} embedded />
      </div>
    );
  }

  return <DeepReadView submissionId={submissionId} />;
}

function DeepReadView({ submissionId }: { submissionId: string }) {
  const [showAsSubmitted, setShowAsSubmitted] = useState(false);

  const { data: submission, isPending } = trpc.submissions.getById.useQuery({
    id: submissionId,
  });

  if (isPending) {
    return (
      <div className="p-8 max-w-[65ch] mx-auto space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Submission not found
      </div>
    );
  }

  // Convert plain text content to ProseMirror doc (fallback path —
  // the only path until the backend content extraction pipeline ships)
  const content = submission.content
    ? textToProseMirrorDoc(submission.content)
    : null;

  return (
    <DensityProvider density="comfortable">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-[65ch] px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-lg font-medium text-muted-foreground">
                {submission.title ?? "Untitled"}
              </h2>
              {submission.submitterEmail && (
                <p className="text-sm text-muted-foreground/70 mt-0.5">
                  {submission.submitterEmail}
                </p>
              )}
            </div>
            {content && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-as-submitted"
                  checked={showAsSubmitted}
                  onCheckedChange={setShowAsSubmitted}
                />
                <Label
                  htmlFor="show-as-submitted"
                  className="text-xs text-muted-foreground"
                >
                  As submitted
                </Label>
              </div>
            )}
          </div>

          {/* Manuscript content */}
          {content ? (
            <ManuscriptRenderer
              content={content}
              showAsSubmitted={showAsSubmitted}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              No text content available for this submission.
            </p>
          )}

          {/* Cover letter */}
          {submission.coverLetter && (
            <div className="mt-12 pt-8 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Cover Letter
              </h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {submission.coverLetter}
              </div>
            </div>
          )}
        </div>
      </div>
    </DensityProvider>
  );
}
