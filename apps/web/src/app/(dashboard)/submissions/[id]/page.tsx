import { SubmissionDetail } from "@/components/submissions/submission-detail";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-6">
      <SubmissionDetail submissionId={id} />
    </div>
  );
}
