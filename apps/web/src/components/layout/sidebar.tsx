"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/use-organization";
import { navGroups, type NavItem, type SubBrand } from "@/lib/navigation";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/editor") return pathname === "/editor";
  if (href === "/slate") return pathname === "/slate";
  if (href === "/workspace") return pathname === "/workspace";
  return pathname.startsWith(href);
}

function isGroupActive(pathname: string, items: NavItem[]): boolean {
  return items.some((item) => isActiveLink(pathname, item.href));
}

interface NavGroupProps {
  label: string;
  items: NavItem[];
  pathname: string;
  showDivider?: boolean;
}

function NavGroup({
  label,
  items,
  pathname,
  showDivider = true,
}: NavGroupProps) {
  const active = isGroupActive(pathname, items);

  return (
    <>
      {showDivider && <div className="my-2 border-t border-sidebar-border" />}
      <p
        className={cn(
          "px-3 text-[12px] font-semibold uppercase tracking-wider",
          active ? "text-sidebar-foreground" : "text-sidebar-muted",
        )}
      >
        {label}
      </p>
      {items.map((item) => {
        const isActive = isActiveLink(pathname, item.href);
        const link = (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-[13px] transition-colors",
              isActive
                ? "text-sidebar-foreground border-l-2 border-sidebar-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
        if (item.description) {
          return (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.description}
              </TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </>
  );
}

interface SubBrandPreheaderProps {
  name: SubBrand;
  isFirst: boolean;
}

function SubBrandPreheader({ name, isFirst }: SubBrandPreheaderProps) {
  return (
    <p
      className={cn(
        "px-3 font-medium text-[11px] uppercase tracking-[0.1em] text-sidebar-muted",
        isFirst ? "mt-1" : "mt-5",
        "mb-1",
      )}
    >
      {name}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isEditor, isProduction, isBusinessOps, isAdmin } = useOrganization();

  const roleCheck: Record<string, boolean> = {
    editor: isEditor,
    production: isProduction,
    business_ops: isBusinessOps,
    admin: isAdmin,
  };

  const visibleGroups = navGroups.filter(
    (g) => g.role === null || roleCheck[g.role],
  );

  // Precompute which groups need a sub-brand preheader (first occurrence of each sub-brand)
  const seen = new Set<SubBrand>();
  const preheaderFlags = visibleGroups.map((group) => {
    const show = !seen.has(group.subBrand);
    seen.add(group.subBrand);
    return show;
  });

  return (
    <div className="flex flex-col h-full bg-sidebar-background">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="font-bold text-lg text-sidebar-foreground">
          Colophony
        </Link>
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={450}>
        <nav className="flex-1 space-y-1 p-2" aria-label="Main navigation">
          {visibleGroups.map((group, index) => {
            const showPreheader = preheaderFlags[index];
            const isFirstGroup = index === 0;

            return (
              <div key={group.label}>
                {showPreheader && (
                  <SubBrandPreheader
                    name={group.subBrand}
                    isFirst={isFirstGroup}
                  />
                )}
                <NavGroup
                  label={group.label}
                  items={[...group.items]}
                  pathname={pathname}
                  showDivider={!showPreheader && !isFirstGroup}
                />
              </div>
            );
          })}
        </nav>
      </TooltipProvider>
    </div>
  );
}
