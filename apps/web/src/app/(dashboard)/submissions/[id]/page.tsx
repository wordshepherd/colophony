import { SubmissionDetail } from '@/components/submissions/submission-detail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({ params }: Props) {
  const { id } = await params;
  return <SubmissionDetail submissionId={id} />;
}
