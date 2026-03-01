"use client";

import { use } from "react";
import { ExternalSubmissionDetail } from "@/components/workspace/external-submission-detail";

export default function ExternalSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="p-6">
      <ExternalSubmissionDetail id={id} />
    </div>
  );
}
