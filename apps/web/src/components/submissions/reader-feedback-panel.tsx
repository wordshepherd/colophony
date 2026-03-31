"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, MessageCircle, Forward } from "lucide-react";
import { orgSettingsSchema } from "@colophony/types";

interface ReaderFeedbackPanelProps {
  submissionId: string;
}

export function ReaderFeedbackPanel({
  submissionId,
}: ReaderFeedbackPanelProps) {
  const { isEditor, isAdmin } = useOrganization();
  const utils = trpc.useUtils();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isForwardable, setIsForwardable] = useState(false);

  // Fetch org settings to check if reader feedback is enabled
  const { data: org } = trpc.organizations.get.useQuery();
  const feedbackSettings = useMemo(() => {
    if (!org?.settings) return { enabled: false, tags: [] as string[] };
    const parsed = orgSettingsSchema.safeParse(org.settings);
    return parsed.success
      ? {
          enabled: parsed.data.readerFeedbackEnabled,
          tags: parsed.data.readerFeedbackTags,
        }
      : { enabled: false, tags: [] as string[] };
  }, [org]);

  // Editor view: list all feedback for this submission
  const { data: feedbackList, isPending: listLoading } =
    trpc.readerFeedback.list.useQuery(
      { submissionId, page: 1, limit: 50 },
      { enabled: feedbackSettings.enabled && (isEditor || isAdmin) },
    );

  const createMutation = trpc.readerFeedback.create.useMutation({
    onSuccess: () => {
      toast.success("Feedback submitted");
      setSelectedTags([]);
      setComment("");
      setIsForwardable(false);
      utils.readerFeedback.list.invalidate({ submissionId });
    },
    onError: (err) => toast.error(err.message),
  });

  const forwardMutation = trpc.readerFeedback.forward.useMutation({
    onSuccess: () => {
      toast.success("Feedback forwarded");
      utils.readerFeedback.list.invalidate({ submissionId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!feedbackSettings.enabled) return null;

  const handleSubmit = () => {
    createMutation.mutate({
      submissionId,
      tags: selectedTags,
      comment: comment || undefined,
      isForwardable,
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Reader Feedback
        </CardTitle>
        <CardDescription>
          {isEditor || isAdmin
            ? "View and forward reader feedback for this submission."
            : "Leave feedback on this submission for the editorial team."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Leave feedback form — all reviewers */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Leave Feedback</Label>

          {feedbackSettings.tags.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Tags (select up to 5)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {feedbackSettings.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (
                        !selectedTags.includes(tag) &&
                        selectedTags.length >= 5
                      )
                        return;
                      toggleTag(tag);
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label
              htmlFor="feedback-comment"
              className="text-xs text-muted-foreground"
            >
              Comment (max 280 characters)
            </Label>
            <Textarea
              id="feedback-comment"
              placeholder="Brief feedback for the editorial team..."
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/280
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="forwardable"
              checked={isForwardable}
              onCheckedChange={(checked) => setIsForwardable(checked === true)}
            />
            <Label htmlFor="forwardable" className="text-sm">
              Allow editors to share this feedback with the writer (anonymized)
            </Label>
          </div>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={
              createMutation.isPending ||
              (selectedTags.length === 0 && !comment.trim())
            }
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit Feedback
          </Button>
        </div>

        {/* Editor view: all feedback for this submission */}
        {(isEditor || isAdmin) && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                All Feedback ({feedbackList?.total ?? 0})
              </Label>

              {listLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}

              {feedbackList?.items.map((fb) => (
                <div key={fb.id} className="border rounded-md p-3 space-y-2">
                  {(fb.tags as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(fb.tags as string[]).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {fb.comment && <p className="text-sm">{fb.comment}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {fb.forwardedAt
                        ? "Forwarded"
                        : fb.isForwardable
                          ? "Forwardable"
                          : "Not forwardable"}
                    </span>
                    {fb.isForwardable && !fb.forwardedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          forwardMutation.mutate({ feedbackId: fb.id })
                        }
                        disabled={forwardMutation.isPending}
                      >
                        <Forward className="mr-1 h-3 w-3" />
                        Forward
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {feedbackList && feedbackList.items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No feedback yet.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
