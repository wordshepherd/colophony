"use client";

import { trpc } from "@/lib/trpc";

export function usePluginRegistry() {
  const { data, isPending, error, refetch } =
    trpc.plugins.listRegistry.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });

  return {
    plugins: data ?? [],
    isLoading: isPending,
    error: error ?? null,
    refetch,
  };
}

export function usePluginRegistryEntry(pluginId: string | null) {
  const { data, isPending, error } = trpc.plugins.getRegistryEntry.useQuery(
    { pluginId: pluginId! },
    {
      enabled: !!pluginId,
      staleTime: 5 * 60 * 1000,
    },
  );

  return {
    plugin: data ?? null,
    isLoading: isPending,
    error: error ?? null,
  };
}
