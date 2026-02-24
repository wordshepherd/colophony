import { IssueForm } from "@/components/slate/issue-form";

export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <IssueForm issueId={id} />
    </div>
  );
}
