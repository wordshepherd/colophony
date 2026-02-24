import { PublicationDetail } from "@/components/slate/publication-detail";

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <PublicationDetail publicationId={id} />
    </div>
  );
}
