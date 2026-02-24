import { ContractTemplateForm } from "@/components/slate/contract-template-form";

export default async function EditContractTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <ContractTemplateForm templateId={id} />
    </div>
  );
}
