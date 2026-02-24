import { CmsConnectionForm } from "@/components/slate/cms-connection-form";

export default async function EditCmsConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <CmsConnectionForm connectionId={id} />
    </div>
  );
}
