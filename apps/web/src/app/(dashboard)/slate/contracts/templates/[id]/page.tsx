import { ContractTemplateDetail } from "@/components/slate/contract-template-detail";

export default async function ContractTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <ContractTemplateDetail templateId={id} />
    </div>
  );
}
