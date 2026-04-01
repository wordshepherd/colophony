"use client";

import { CheckCircle, Mail } from "lucide-react";

interface EmbedSuccessProps {
  submissionId: string;
  periodName: string;
  statusToken?: string;
}

export function EmbedSuccess({
  submissionId,
  periodName,
  statusToken,
}: EmbedSuccessProps) {
  const statusUrl = statusToken ? `/embed/status/${statusToken}` : null;

  return (
    <div className="flex flex-col items-center text-center py-8 space-y-4">
      <CheckCircle className="h-16 w-16 text-status-success" />
      <div>
        <h2 className="text-xl font-semibold">Submission Received</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your submission to <strong>{periodName}</strong> has been received.
        </p>
      </div>
      {statusToken && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>A confirmation email has been sent to your inbox.</span>
        </div>
      )}
      {statusUrl && (
        <a
          href={statusUrl}
          className="text-sm text-primary underline hover:no-underline"
          data-testid="status-check-link"
        >
          Check your submission status
        </a>
      )}
      <p className="text-xs text-muted-foreground">
        Confirmation ID: {submissionId}
      </p>
    </div>
  );
}
