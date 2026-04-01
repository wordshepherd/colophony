"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { resolveNavContext } from "@/lib/navigation";

export function BreadcrumbBar() {
  const pathname = usePathname();
  const context = resolveNavContext(pathname);

  if (!context) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 px-6 pt-4 pb-0"
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">
        {context.subBrand}
      </span>
      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      <span className="text-sm text-muted-foreground">
        {context.groupLabel}
      </span>
      {context.pageName && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground/80">
            {context.pageName}
          </span>
        </>
      )}
    </nav>
  );
}
