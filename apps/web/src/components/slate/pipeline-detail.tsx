"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { PipelineStageBadge } from "./pipeline-stage-badge";
import { PipelineStageTransition } from "./pipeline-stage-transition";
import { PipelineRoleAssignment } from "./pipeline-role-assignment";
import { PipelineComments } from "./pipeline-comments";
import { PipelineHistory } from "./pipeline-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

interface PipelineDetailProps {
  pipelineItemId: string;
}

export function PipelineDetail({ pipelineItemId }: PipelineDetailProps) {
  const { isAdmin } = useOrganization();

  const { data: item, isPending: isLoading } = trpc.pipeline.getById.useQuery({
    id: pipelineItemId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Pipeline item not found</p>
        <Link href="/slate/pipeline">
          <Button variant="link">Back to pipeline</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/slate/pipeline"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to pipeline
        </Link>
        <h1 className="text-2xl font-bold">Pipeline Item</h1>
        <div className="flex items-center gap-2">
          <PipelineStageBadge stage={item.stage} />
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main column */}
        <div className="md:col-span-2 space-y-6">
          {/* Stage Transition */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Stage Transition</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineStageTransition
                  pipelineItemId={pipelineItemId}
                  currentStage={item.stage}
                />
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Submission
                </p>
                <Link
                  href={`/editor/${item.submissionId}`}
                  className="text-sm font-mono hover:underline"
                >
                  {item.submissionId}
                </Link>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Publication
                </p>
                <p className="text-sm font-mono">
                  {item.publicationId ?? "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="text-sm">
                  {format(new Date(item.createdAt), "PPP")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Role Assignment */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Role Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineRoleAssignment
                  pipelineItemId={pipelineItemId}
                  currentCopyeditorId={item.assignedCopyeditorId}
                  currentProofreaderId={item.assignedProofreaderId}
                />
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineComments pipelineItemId={pipelineItemId} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Stage
                </p>
                <div className="mt-1">
                  <PipelineStageBadge stage={item.stage} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Copyedit Due
                </p>
                <p className="text-sm mt-1">
                  {item.copyeditDueAt
                    ? format(new Date(item.copyeditDueAt), "PPP")
                    : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Proofread Due
                </p>
                <p className="text-sm mt-1">
                  {item.proofreadDueAt
                    ? format(new Date(item.proofreadDueAt), "PPP")
                    : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Author Review Due
                </p>
                <p className="text-sm mt-1">
                  {item.authorReviewDueAt
                    ? format(new Date(item.authorReviewDueAt), "PPP")
                    : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Inngest Run ID
                </p>
                <p className="text-sm mt-1 font-mono">
                  {item.inngestRunId ?? "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </p>
                <p className="text-sm mt-1">
                  {formatDistanceToNow(new Date(item.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineHistory pipelineItemId={pipelineItemId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
