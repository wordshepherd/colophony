"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface ReviseAndResubmitCardProps {
  submissionId: string;
  manuscriptId: string;
  revisionNotes: string | null;
  onResubmitSuccess?: () => void;
}

export function ReviseAndResubmitCard({
  submissionId,
  manuscriptId,
  revisionNotes,
  onResubmitSuccess,
}: ReviseAndResubmitCardProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const utils = trpc.useUtils();

  const { data: versions, isPending: isLoadingVersions } =
    trpc.manuscripts.listVersions.useQuery({ manuscriptId });

  const resubmitMutation = trpc.submissions.resubmit.useMutation({
    onSuccess: () => {
      toast.success("Submission resubmitted successfully");
      utils.submissions.getById.invalidate({ id: submissionId });
      utils.submissions.mySubmissionDetail.invalidate({ id: submissionId });
      utils.submissions.getHistory.invalidate({ submissionId });
      utils.submissions.list.invalidate();
      onResubmitSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleResubmit = () => {
    if (!selectedVersionId) return;
    resubmitMutation.mutate({
      id: submissionId,
      manuscriptVersionId: selectedVersionId,
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-amber-900 dark:text-amber-100">
            Revision Requested
          </CardTitle>
        </div>
        <CardDescription className="text-amber-800 dark:text-amber-200">
          The editors have requested revisions. Please review their notes and
          submit an updated manuscript version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {revisionNotes && (
          <div className="rounded-md bg-white p-4 dark:bg-amber-900/30">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
              Revision Notes
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
              {revisionNotes}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Select a manuscript version to resubmit
          </label>
          <Select
            value={selectedVersionId}
            onValueChange={setSelectedVersionId}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingVersions ? "Loading versions..." : "Choose a version"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {versions?.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  Version {version.versionNumber}
                  {version.createdAt
                    ? ` — ${new Date(version.createdAt).toLocaleDateString()}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleResubmit}
          disabled={!selectedVersionId || resubmitMutation.isPending}
          className="w-full"
        >
          {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit"}
        </Button>
      </CardContent>
    </Card>
  );
}
