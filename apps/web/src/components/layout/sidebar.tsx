"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/use-organization";
import { FileText, LayoutDashboard, Settings } from "lucide-react";

const navigation = [
  { name: "My Submissions", href: "/submissions", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

const editorNavigation = [
  { name: "Editor Dashboard", href: "/editor", icon: LayoutDashboard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isEditor } = useOrganization();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="font-bold text-lg">
          Colophony
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {/* Main navigation */}
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}

        {/* Editor navigation */}
        {isEditor && (
          <>
            <div className="my-4 border-t" />
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Editor
            </p>
            {editorNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}
