import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookCopy,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  Copy,
  DollarSign,
  FileCheck,
  FileSignature,
  FileText,
  FolderOpen,
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
  Trophy,
  TrendingUp,
  Upload,
  Users,
  Webhook,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Short description shown in sidebar tooltips and command palette. */
  description?: string;
}

export const writingNavigation: NavItem[] = [
  { name: "Dashboard", href: "/workspace", icon: LayoutDashboard },
  { name: "Manuscripts", href: "/manuscripts", icon: BookOpen },
  { name: "My Submissions", href: "/submissions", icon: FileText },
  {
    name: "External Subs",
    href: "/workspace/external",
    icon: Send,
    description: "Track submissions to non-Colophony journals",
  },
  {
    name: "Sim-Sub Groups",
    href: "/workspace/sim-sub",
    icon: Copy,
    description: "Same piece sent to multiple journals",
  },
  {
    name: "Correspondence",
    href: "/workspace/correspondence",
    icon: Mail,
  },
  {
    name: "Portfolio",
    href: "/workspace/portfolio",
    icon: Layers,
    description: "All submissions in one view",
  },
  { name: "Analytics", href: "/workspace/analytics", icon: BarChart3 },
  { name: "Import", href: "/workspace/import", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const editorialNavigation: NavItem[] = [
  { name: "Editor Dashboard", href: "/editor", icon: LayoutDashboard },
  { name: "Reading Queue", href: "/editor/queue", icon: BookOpen },
  { name: "All Submissions", href: "/editor/submissions", icon: Inbox },
  {
    name: "Collections",
    href: "/editor/collections",
    icon: FolderOpen,
    description: "Organize submissions into reading lists",
  },
  { name: "Forms", href: "/editor/forms", icon: ClipboardList },
  {
    name: "Periods",
    href: "/editor/periods",
    icon: Calendar,
    description: "When you accept submissions",
  },
  { name: "Submission Analytics", href: "/editor/analytics", icon: BarChart3 },
  {
    name: "Editorial Analytics",
    href: "/editor/editorial-analytics",
    icon: TrendingUp,
  },
  {
    name: "Contests",
    href: "/editor/contests",
    icon: Trophy,
    description: "Competitions with rounds and prizes",
  },
];

export const productionNavigation: NavItem[] = [
  { name: "Production Dashboard", href: "/slate", icon: BookMarked },
  { name: "Publications", href: "/slate/publications", icon: Library },
  {
    name: "Pipeline",
    href: "/slate/pipeline",
    icon: GitBranch,
    description: "Accepted pieces in production",
  },
  { name: "Issues", href: "/slate/issues", icon: BookCopy },
  { name: "Calendar", href: "/slate/calendar", icon: Calendar },
  { name: "Contracts", href: "/slate/contracts", icon: FileSignature },
  {
    name: "CMS",
    href: "/slate/cms",
    icon: Globe,
    description: "Publish to WordPress or Ghost",
  },
];

export const businessNavigation: NavItem[] = [
  { name: "Business Dashboard", href: "/business", icon: LayoutDashboard },
  { name: "Contributors", href: "/business/contributors", icon: Users },
  { name: "Rights", href: "/business/rights", icon: FileCheck },
  { name: "Payments", href: "/business/payments", icon: DollarSign },
];

export const operationsNavigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/operations",
    icon: LayoutDashboard,
  },
  {
    name: "Organization",
    href: "/organizations/settings",
    icon: Building2,
  },
  {
    name: "Webhooks",
    href: "/webhooks",
    icon: Webhook,
    description: "Notify external services of events",
  },
  {
    name: "Federation",
    href: "/federation",
    icon: Network,
    description: "Connect with other Colophony instances",
  },
];

export type SubBrand = "Hopper" | "Slate" | "Register";

/** All nav groups with their label, role requirement, and sub-brand */
export const navGroups = [
  {
    label: "Writing",
    items: writingNavigation,
    role: null,
    subBrand: "Hopper" as const,
  },
  {
    label: "Editorial",
    items: editorialNavigation,
    role: "editor" as const,
    subBrand: "Hopper" as const,
  },
  {
    label: "Production",
    items: productionNavigation,
    role: "production" as const,
    subBrand: "Slate" as const,
  },
  {
    label: "Business",
    items: businessNavigation,
    role: "business_ops" as const,
    subBrand: "Slate" as const,
  },
  {
    label: "Operations",
    items: operationsNavigation,
    role: "admin" as const,
    subBrand: "Register" as const,
  },
] as const;

export interface NavContext {
  subBrand: SubBrand;
  groupLabel: string;
  pageName: string | null;
}

// Dashboard roots that require exact-match only (same logic as sidebar isActiveLink)
const exactMatchRoutes = new Set([
  "/editor",
  "/slate",
  "/workspace",
  "/business",
  "/operations",
]);

/**
 * Resolve the navigation context for a given pathname.
 * Uses longest-prefix matching against nav items, with exact-match
 * enforcement for dashboard root routes (same rules as sidebar).
 * Returns null if no group matches.
 */
export function resolveNavContext(pathname: string): NavContext | null {
  let bestMatch: {
    subBrand: SubBrand;
    groupLabel: string;
    pageName: string;
    matchLength: number;
  } | null = null;

  for (const group of navGroups) {
    for (const item of group.items) {
      const isExactOnly = exactMatchRoutes.has(item.href);
      const isMatch = isExactOnly
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
      if (isMatch && item.href.length > (bestMatch?.matchLength ?? 0)) {
        bestMatch = {
          subBrand: group.subBrand,
          groupLabel: group.label,
          pageName: item.name,
          matchLength: item.href.length,
        };
      }
    }
  }

  if (bestMatch) {
    return {
      subBrand: bestMatch.subBrand,
      groupLabel: bestMatch.groupLabel,
      pageName: bestMatch.pageName,
    };
  }

  // Fallback: check if pathname falls under a group's common prefix
  // e.g., /editor/something-not-in-nav still belongs to Editorial
  for (const group of navGroups) {
    for (const item of group.items) {
      // Check if the pathname shares a base path with any item in the group
      const basePath = item.href.split("/").slice(0, 2).join("/");
      if (
        basePath.length > 1 &&
        (pathname === basePath || pathname.startsWith(basePath + "/"))
      ) {
        return {
          subBrand: group.subBrand,
          groupLabel: group.label,
          pageName: null,
        };
      }
    }
  }

  return null;
}
