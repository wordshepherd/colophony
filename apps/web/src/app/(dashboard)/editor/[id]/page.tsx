import { SubmissionDetail } from "@/components/submissions/submission-detail";

export default async function EditorSubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ queue?: string; idx?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const queueIds = sp.queue ? sp.queue.split(",").filter(Boolean) : undefined;
  const queueIdx =
    sp.idx != null && queueIds ? parseInt(sp.idx, 10) : undefined;

  return (
    <div className="p-6">
      <SubmissionDetail
        submissionId={id}
        backHref="/editor/submissions"
        queueIds={queueIds}
        queueIdx={queueIdx}
      />
    </div>
  );
}
