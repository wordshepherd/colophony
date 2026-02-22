"use client";

import { ManuscriptForm } from "@/components/manuscripts/manuscript-form";

export default function NewManuscriptPage() {
  return (
    <div className="p-6">
      <ManuscriptForm mode="create" />
    </div>
  );
}
