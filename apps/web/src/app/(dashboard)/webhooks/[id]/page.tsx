import { WebhookDetail } from "@/components/webhooks/webhook-detail";

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <WebhookDetail endpointId={id} />
    </div>
  );
}
