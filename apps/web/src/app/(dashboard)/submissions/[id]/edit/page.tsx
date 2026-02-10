import { SubmissionForm } from "@/components/submissions/submission-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSubmissionPage({ params }: Props) {
  const { id } = await params;
  return <SubmissionForm mode="edit" submissionId={id} />;
}
