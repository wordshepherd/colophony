import { PipelineDetail } from "@/components/slate/pipeline-detail";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <PipelineDetail pipelineItemId={id} />
    </div>
  );
}
