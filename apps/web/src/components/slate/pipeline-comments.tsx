"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { PipelineStageBadge } from "./pipeline-stage-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface PipelineCommentsProps {
  pipelineItemId: string;
}

export function PipelineComments({ pipelineItemId }: PipelineCommentsProps) {
  const [content, setContent] = useState("");
  const utils = trpc.useUtils();

  const { data: comments, isPending: isLoading } =
    trpc.pipeline.listComments.useQuery({ id: pipelineItemId });

  const addCommentMutation = trpc.pipeline.addComment.useMutation({
    onSuccess: () => {
      setContent("");
      toast.success("Comment added");
      utils.pipeline.listComments.invalidate({ id: pipelineItemId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    addCommentMutation.mutate({ id: pipelineItemId, content: trimmed });
  };

  return (
    <div className="space-y-4">
      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || addCommentMutation.isPending}
        >
          {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
        </Button>
      </form>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {comment.authorId && (
                  <span className="font-mono">
                    {comment.authorId.slice(0, 8)}&hellip;
                  </span>
                )}
                <PipelineStageBadge stage={comment.stage} />
                <span>
                  {formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
    </div>
  );
}
