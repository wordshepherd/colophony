import { PeerDetail } from "@/components/federation/peer-detail";

export default async function PeerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <PeerDetail peerId={id} />
    </div>
  );
}
