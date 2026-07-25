import { EmbedForm } from "@/components/embed/embed-form";
import { clientEnv } from "@/env";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const apiUrl = clientEnv.NEXT_PUBLIC_API_URL;

  return <EmbedForm token={token} apiUrl={apiUrl} />;
}
