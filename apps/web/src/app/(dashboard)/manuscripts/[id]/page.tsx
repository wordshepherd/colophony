import { ManuscriptDetail } from "@/components/manuscripts/manuscript-detail";

export default async function ManuscriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-6">
      <ManuscriptDetail manuscriptId={id} />
    </div>
  );
}
