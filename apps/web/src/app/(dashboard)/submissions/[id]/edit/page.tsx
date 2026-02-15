import { SubmissionForm } from "@/components/submissions/submission-form";

export default async function EditSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-6">
      <SubmissionForm mode="edit" submissionId={id} />
    </div>
  );
}
