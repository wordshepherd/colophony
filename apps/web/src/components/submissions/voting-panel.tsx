"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Vote, Trash2 } from "lucide-react";
import type { VoteDecision } from "@colophony/types";

interface VotingPanelProps {
  submissionId: string;
  votingEnabled: boolean;
  scoringEnabled: boolean;
  scoreMin: number;
  scoreMax: number;
}

const DECISION_LABELS: Record<
  VoteDecision,
  { label: string; variant: "default" | "destructive" | "secondary" }
> = {
  ACCEPT: { label: "Accept", variant: "default" },
  REJECT: { label: "Reject", variant: "destructive" },
  MAYBE: { label: "Maybe", variant: "secondary" },
};

export function VotingPanel({
  submissionId,
  votingEnabled,
  scoringEnabled,
  scoreMin,
  scoreMax,
}: VotingPanelProps) {
  const { user, isEditor, isAdmin } = useOrganization();
  const utils = trpc.useUtils();

  const [decision, setDecision] = useState<VoteDecision | "">("");
  const [score, setScore] = useState<string>("");

  const { data: votes, isPending: votesLoading } =
    trpc.submissions.listVotes.useQuery({ submissionId });

  const { data: summary } = trpc.submissions.getVoteSummary.useQuery(
    { submissionId },
    { enabled: isEditor || isAdmin },
  );

  const castVoteMutation = trpc.submissions.castVote.useMutation({
    onSuccess: () => {
      toast.success("Vote recorded");
      utils.submissions.listVotes.invalidate({ submissionId });
      utils.submissions.getVoteSummary.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteVoteMutation = trpc.submissions.deleteVote.useMutation({
    onSuccess: () => {
      toast.success("Vote removed");
      setDecision("");
      setScore("");
      utils.submissions.listVotes.invalidate({ submissionId });
      utils.submissions.getVoteSummary.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!votingEnabled) return null;

  const myVote = votes?.find((v) => v.voterUserId === user?.id);

  const handleSubmit = () => {
    if (!decision) return;
    let scoreNum: number | undefined;
    if (scoringEnabled && score) {
      const parsed = Number(score);
      if (Number.isNaN(parsed)) return;
      scoreNum = parsed;
    }
    castVoteMutation.mutate({
      submissionId,
      decision,
      score: scoreNum,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          Voting
        </CardTitle>
        <CardDescription>Cast your vote on this submission.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* My Vote */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Your Vote</Label>
          <RadioGroup
            value={decision || myVote?.decision || ""}
            onValueChange={(val) => setDecision(val as VoteDecision)}
          >
            {(["ACCEPT", "REJECT", "MAYBE"] as VoteDecision[]).map((d) => (
              <div key={d} className="flex items-center space-x-2">
                <RadioGroupItem value={d} id={`vote-${d}`} />
                <Label htmlFor={`vote-${d}`}>{DECISION_LABELS[d].label}</Label>
              </div>
            ))}
          </RadioGroup>

          {scoringEnabled && (
            <div className="space-y-1">
              <Label htmlFor="vote-score" className="text-sm">
                Score ({scoreMin}–{scoreMax})
              </Label>
              <Input
                id="vote-score"
                type="number"
                min={scoreMin}
                max={scoreMax}
                step="0.5"
                placeholder={`${scoreMin}–${scoreMax}`}
                value={score || (myVote?.score?.toString() ?? "")}
                onChange={(e) => setScore(e.target.value)}
                className="w-32"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!decision || castVoteMutation.isPending}
            >
              {castVoteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {myVote ? "Update Vote" : "Submit Vote"}
            </Button>
            {myVote && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteVoteMutation.mutate({ submissionId })}
                disabled={deleteVoteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Vote Summary — editors/admins only */}
        {(isEditor || isAdmin) && summary && summary.totalVotes > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Summary</Label>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600">
                  Accept: {summary.acceptCount}
                </span>
                <span className="text-red-600">
                  Reject: {summary.rejectCount}
                </span>
                <span className="text-yellow-600">
                  Maybe: {summary.maybeCount}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {summary.totalVotes} total vote
                {summary.totalVotes !== 1 ? "s" : ""}
                {summary.averageScore != null && (
                  <> &middot; Avg score: {summary.averageScore.toFixed(1)}</>
                )}
              </p>
            </div>
          </>
        )}

        {/* All Votes */}
        {votes && votes.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">All Votes</Label>
              <div className="space-y-1">
                {votes.map((vote) => (
                  <div
                    key={vote.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground truncate">
                      {vote.voterEmail ?? "Unknown"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={DECISION_LABELS[vote.decision].variant}>
                        {DECISION_LABELS[vote.decision].label}
                      </Badge>
                      {vote.score != null && (
                        <span className="text-muted-foreground">
                          {vote.score}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {votesLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
