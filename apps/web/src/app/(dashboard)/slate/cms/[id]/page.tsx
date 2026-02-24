import { CmsConnectionDetail } from "@/components/slate/cms-connection-detail";

export default async function CmsConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <CmsConnectionDetail connectionId={id} />
    </div>
  );
}
