"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/use-organization";
import {
  BarChart3,
  BookCopy,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  FileSignature,
  FileText,
  GitBranch,
  Globe,
  Inbox,
  Layers,
  LayoutDashboard,
  Library,
  Mail,
  Network,
  Send,
  Settings,
  Upload,
  Webhook,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const writingNavigation: NavItem[] = [
  { name: "Dashboard", href: "/workspace", icon: LayoutDashboard },
  { name: "Manuscripts", href: "/manuscripts", icon: BookOpen },
  { name: "My Submissions", href: "/submissions", icon: FileText },
  { name: "External Subs", href: "/workspace/external", icon: Send },
  {
    name: "Correspondence",
    href: "/workspace/correspondence",
    icon: Mail,
  },
  { name: "Portfolio", href: "/workspace/portfolio", icon: Layers },
  { name: "Analytics", href: "/workspace/analytics", icon: BarChart3 },
  { name: "Import", href: "/workspace/import", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];

const editorialNavigation: NavItem[] = [
  { name: "Editor Dashboard", href: "/editor", icon: LayoutDashboard },
  { name: "Reading Queue", href: "/editor/queue", icon: BookOpen },
  { name: "All Submissions", href: "/editor/submissions", icon: Inbox },
  { name: "Forms", href: "/editor/forms", icon: ClipboardList },
  { name: "Periods", href: "/editor/periods", icon: Calendar },
];

const productionNavigation: NavItem[] = [
  { name: "Production Dashboard", href: "/slate", icon: BookMarked },
  { name: "Publications", href: "/slate/publications", icon: Library },
  { name: "Pipeline", href: "/slate/pipeline", icon: GitBranch },
  { name: "Issues", href: "/slate/issues", icon: BookCopy },
  { name: "Calendar", href: "/slate/calendar", icon: Calendar },
  { name: "Contracts", href: "/slate/contracts", icon: FileSignature },
  { name: "CMS", href: "/slate/cms", icon: Globe },
];

const operationsNavigation: NavItem[] = [
  {
    name: "Organization",
    href: "/organizations/settings",
    icon: Building2,
  },
  {
    name: "Webhooks",
    href: "/webhooks",
    icon: Webhook,
  },
  {
    name: "Federation",
    href: "/federation",
    icon: Network,
  },
];

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
  const { isEditor, isAdmin } = useOrganization();

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

        {isEditor && (
          <NavGroup
            label="Production"
            items={productionNavigation}
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
