import { PublicationForm } from "@/components/slate/publication-form";

export default async function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <PublicationForm publicationId={id} />
    </div>
  );
}
