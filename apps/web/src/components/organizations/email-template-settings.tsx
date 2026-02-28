"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailTemplateEditor } from "./email-template-editor";

export function EmailTemplateSettings() {
  const { isAdmin } = useOrganization();
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);

  const { data: templates, isPending: isLoading } =
    trpc.emailTemplates.list.useQuery();

  if (editingTemplate) {
    const tpl = templates?.find((t) => t.templateName === editingTemplate);
    return (
      <EmailTemplateEditor
        templateName={editingTemplate}
        mergeFields={tpl?.mergeFields ?? []}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates?.map((tpl) => (
        <Card
          key={tpl.templateName}
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setEditingTemplate(tpl.templateName)}
        >
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{tpl.label}</CardTitle>
              <Badge variant={tpl.isCustomized ? "default" : "secondary"}>
                {tpl.isCustomized ? "Customized" : "Default"}
              </Badge>
            </div>
            <CardDescription>{tpl.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Only admins can customize email templates.
        </p>
      )}
    </div>
  );
}
