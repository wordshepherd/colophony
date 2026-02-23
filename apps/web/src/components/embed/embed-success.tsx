"use client";

import { CheckCircle } from "lucide-react";

interface EmbedSuccessProps {
  submissionId: string;
  periodName: string;
}

export function EmbedSuccess({ submissionId, periodName }: EmbedSuccessProps) {
  return (
    <div className="flex flex-col items-center text-center py-8 space-y-4">
      <CheckCircle className="h-16 w-16 text-green-600" />
      <div>
        <h2 className="text-xl font-semibold">Submission Received</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your submission to <strong>{periodName}</strong> has been received.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Confirmation ID: {submissionId}
      </p>
    </div>
  );
}
