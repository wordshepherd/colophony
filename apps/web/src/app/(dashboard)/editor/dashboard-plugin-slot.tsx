"use client";

import { PluginSlot } from "@/components/plugins/plugin-slot";

export function DashboardPluginSlot() {
  return (
    <PluginSlot
      point="dashboard.widget"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    />
  );
}
