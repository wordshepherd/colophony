import { ContractDetail } from "@/components/slate/contract-detail";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <ContractDetail contractId={id} />
    </div>
  );
}
