import { EmbedStatusCheck } from "@/components/embed/embed-status-check";

export default async function EmbedStatusPage({
  params,
}: {
  params: Promise<{ statusToken: string }>;
}) {
  const { statusToken } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return <EmbedStatusCheck statusToken={statusToken} apiUrl={apiUrl} />;
}
