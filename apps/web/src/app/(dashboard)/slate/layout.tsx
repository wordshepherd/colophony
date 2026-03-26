"use client";

import { DensityProvider } from "@/hooks/use-density";

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DensityProvider density="compact">{children}</DensityProvider>;
}
