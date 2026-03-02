import { MigrationDetail } from "@/components/federation/migration-detail";

export default async function MigrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <MigrationDetail migrationId={id} />
    </div>
  );
}
