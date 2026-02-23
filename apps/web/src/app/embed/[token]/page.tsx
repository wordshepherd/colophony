import { EmbedForm } from "@/components/embed/embed-form";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return <EmbedForm token={token} apiUrl={apiUrl} />;
}
