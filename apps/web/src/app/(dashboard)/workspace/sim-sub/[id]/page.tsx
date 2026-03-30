"use client";

import { use } from "react";
import { SimsubGroupDetail } from "@/components/sim-sub/simsub-group-detail";

export default function SimSubGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="p-6">
      <SimsubGroupDetail groupId={id} />
    </div>
  );
}
