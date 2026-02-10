"use client";

import { use } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SubmissionReview } from "@/components/editor/submission-review";

interface Props {
  params: Promise<{ id: string }>;
}

export default function SubmissionReviewPage({ params }: Props) {
  const { id } = use(params);

  return (
    <ProtectedRoute requireEditor>
      <SubmissionReview submissionId={id} />
    </ProtectedRoute>
  );
}
