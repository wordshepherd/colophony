"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  isDemoMode,
  getDemoRole,
  getDemoDisplayName,
  clearDemo,
  loginAsDemo,
} from "@/lib/demo-auth";

export function DemoBanner() {
  const router = useRouter();
  const role = getDemoRole();
  const displayName = getDemoDisplayName();

  const handleSwitchRole = useCallback(async () => {
    const newRole = role === "writer" ? "editor" : "writer";
    clearDemo();
    try {
      const redirectPath = await loginAsDemo(newRole);
      window.location.href = redirectPath;
    } catch {
      window.location.href = "/demo";
    }
  }, [role]);

  const handleExit = useCallback(() => {
    clearDemo();
    router.push("/demo");
  }, [router]);

  if (!isDemoMode()) return null;

  const switchLabel =
    role === "writer" ? "Switch to Editor" : "Switch to Writer";

  return (
    <div className="flex items-center justify-between gap-4 bg-primary/10 px-4 py-2 text-sm border-b border-primary/20">
      <p className="truncate">
        Exploring as <span className="font-semibold">{displayName}</span>
        <span className="text-muted-foreground">
          {" "}
          ({role === "writer" ? "Writer" : "Editor"})
        </span>
        <span className="hidden sm:inline text-muted-foreground">
          {" "}
          &mdash; demo data resets every few hours
        </span>
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleSwitchRole}
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          {switchLabel}
        </button>
        <button
          onClick={handleExit}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
