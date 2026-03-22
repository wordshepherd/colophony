import { EmbedResubmit } from "@/components/embed/embed-resubmit";

export default async function EmbedResubmitPage({
  params,
}: {
  params: Promise<{ statusToken: string }>;
}) {
  const { statusToken } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return <EmbedResubmit statusToken={statusToken} apiUrl={apiUrl} />;
}
