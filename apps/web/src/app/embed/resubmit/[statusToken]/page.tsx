import { EmbedResubmit } from "@/components/embed/embed-resubmit";
import { clientEnv } from "@/env";

export default async function EmbedResubmitPage({
  params,
}: {
  params: Promise<{ statusToken: string }>;
}) {
  const { statusToken } = await params;
  const apiUrl = clientEnv.NEXT_PUBLIC_API_URL;

  return <EmbedResubmit statusToken={statusToken} apiUrl={apiUrl} />;
}
