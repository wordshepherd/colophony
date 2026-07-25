import { EmbedStatusCheck } from "@/components/embed/embed-status-check";
import { clientEnv } from "@/env";

export default async function EmbedStatusPage({
  params,
}: {
  params: Promise<{ statusToken: string }>;
}) {
  const { statusToken } = await params;
  const apiUrl = clientEnv.NEXT_PUBLIC_API_URL;

  return <EmbedStatusCheck statusToken={statusToken} apiUrl={apiUrl} />;
}
