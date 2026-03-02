import { TransferDetail } from "@/components/federation/transfer-detail";

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <TransferDetail transferId={id} />
    </div>
  );
}
