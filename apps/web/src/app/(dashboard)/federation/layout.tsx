"use client";

import { DensityProvider } from "@/hooks/use-density";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <DensityProvider density="compact">{children}</DensityProvider>;
}
