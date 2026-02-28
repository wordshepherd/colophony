"use client";

import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ReviewerListProps {
  submissionId: string;
}

export function ReviewerList({ submissionId }: ReviewerListProps) {
  const { isEditor, isAdmin } = useOrganization();
  const utils = trpc.useUtils();

  const { data: reviewers, isPending: isLoading } =
    trpc.submissions.listReviewers.useQuery({ submissionId });

  const unassignMutation = trpc.submissions.unassignReviewer.useMutation({
    onSuccess: () => {
      toast.success("Reviewer removed");
      utils.submissions.listReviewers.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!reviewers || reviewers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No reviewers assigned</p>
    );
  }

  return (
    <div className="space-y-2">
      {reviewers.map((reviewer) => (
        <div
          key={reviewer.id}
          className="flex items-center gap-3 p-2 border rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {reviewer.reviewerEmail ?? "[Anonymous]"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-xs">
                {reviewer.reviewerRole}
              </Badge>
              {reviewer.readAt ? (
                <Badge variant="default" className="text-xs gap-1 bg-green-600">
                  <Eye className="h-3 w-3" />
                  Read{" "}
                  {formatDistanceToNow(new Date(reviewer.readAt), {
                    addSuffix: true,
                  })}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <EyeOff className="h-3 w-3" />
                  Unread
                </Badge>
              )}
            </div>
          </div>
          {(isEditor || isAdmin) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() =>
                unassignMutation.mutate({
                  submissionId,
                  reviewerUserId: reviewer.reviewerUserId,
                })
              }
              disabled={unassignMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
