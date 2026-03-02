import { HubInstanceDetail } from "@/components/federation/hub-instance-detail";

export default async function HubInstanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <HubInstanceDetail instanceId={id} />
    </div>
  );
}
