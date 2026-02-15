"use client";

import { SubmissionForm } from "@/components/submissions/submission-form";

export default function NewSubmissionPage() {
  return (
    <div className="p-6">
      <SubmissionForm mode="create" />
    </div>
  );
}
