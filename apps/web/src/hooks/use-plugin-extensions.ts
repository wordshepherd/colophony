"use client";

import { trpc } from "@/lib/trpc";

// Keep in sync with packages/plugin-sdk/src/ui/types.ts UIContributionPoint
// and apps/api/src/trpc/routers/plugins.ts uiExtensionPointEnum
export type UIContributionPoint =
  | "dashboard.widget"
  | "submission.detail.section"
  | "submission.list.action"
  | "pipeline.stage.action"
  | "settings.section"
  | "navigation.item"
  | "form.field"
  | "publication.preview";

export function usePluginExtensions(point: UIContributionPoint) {
  const { data, isPending, error } = trpc.plugins.listExtensions.useQuery(
    { point },
    { staleTime: 5 * 60 * 1000 },
  );

  return {
    extensions: data ?? [],
    isLoading: isPending,
    error: error ?? null,
  };
}
