import { IssueDetail } from "@/components/slate/issue-detail";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <IssueDetail issueId={id} />
    </div>
  );
}
