import { IssueForm } from "@/components/slate/issue-form";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ publicationDate?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="p-6">
      <IssueForm initialPublicationDate={params.publicationDate} />
    </div>
  );
}
