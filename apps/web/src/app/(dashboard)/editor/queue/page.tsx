import { EditorialSplitPane } from "@/components/editor/editorial-split-pane";

export default async function EditorQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sp = await searchParams;
  return <EditorialSplitPane initialId={sp.id ?? null} />;
}
