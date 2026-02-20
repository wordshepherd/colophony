"use client";

import { use } from "react";
import { FormEditor } from "@/components/form-builder/form-editor";

export default function FormEditorPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = use(params);

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <FormEditor formId={formId} />
    </div>
  );
}
