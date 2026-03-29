"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/use-organization";
import {
  writingNavigation,
  editorialNavigation,
  productionNavigation,
  businessNavigation,
  operationsNavigation,
  type NavItem,
} from "@/lib/navigation";

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
      {showDivider && <div className="my-4 border-t" />}
      <p
        className={cn(
          "px-3 text-xs font-semibold uppercase tracking-wider",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      {items.map((item) => {
        const isActive = isActiveLink(pathname, item.href);
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
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isEditor, isProduction, isBusinessOps, isAdmin } = useOrganization();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="font-bold text-lg">
          Colophony
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2" aria-label="Main navigation">
        <NavGroup
          label="Writing"
          items={writingNavigation}
          pathname={pathname}
          showDivider={false}
        />

        {isEditor && (
          <NavGroup
            label="Editorial"
            items={editorialNavigation}
            pathname={pathname}
          />
        )}

        {isProduction && (
          <NavGroup
            label="Production"
            items={productionNavigation}
            pathname={pathname}
          />
        )}

        {isBusinessOps && (
          <NavGroup
            label="Business"
            items={businessNavigation}
            pathname={pathname}
          />
        )}

        {isAdmin && (
          <NavGroup
            label="Operations"
            items={operationsNavigation}
            pathname={pathname}
          />
        )}
      </nav>
    </div>
  );
}
