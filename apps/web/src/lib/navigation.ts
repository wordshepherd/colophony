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
}

export const writingNavigation: NavItem[] = [
  { name: "Dashboard", href: "/workspace", icon: LayoutDashboard },
  { name: "Manuscripts", href: "/manuscripts", icon: BookOpen },
  { name: "My Submissions", href: "/submissions", icon: FileText },
  { name: "External Subs", href: "/workspace/external", icon: Send },
  { name: "Sim-Sub Groups", href: "/workspace/sim-sub", icon: Copy },
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

export const editorialNavigation: NavItem[] = [
  { name: "Editor Dashboard", href: "/editor", icon: LayoutDashboard },
  { name: "Reading Queue", href: "/editor/queue", icon: BookOpen },
  { name: "All Submissions", href: "/editor/submissions", icon: Inbox },
  { name: "Collections", href: "/editor/collections", icon: FolderOpen },
  { name: "Forms", href: "/editor/forms", icon: ClipboardList },
  { name: "Periods", href: "/editor/periods", icon: Calendar },
  { name: "Submission Analytics", href: "/editor/analytics", icon: BarChart3 },
  {
    name: "Editorial Analytics",
    href: "/editor/editorial-analytics",
    icon: TrendingUp,
  },
  { name: "Contests", href: "/editor/contests", icon: Trophy },
];

export const productionNavigation: NavItem[] = [
  { name: "Production Dashboard", href: "/slate", icon: BookMarked },
  { name: "Publications", href: "/slate/publications", icon: Library },
  { name: "Pipeline", href: "/slate/pipeline", icon: GitBranch },
  { name: "Issues", href: "/slate/issues", icon: BookCopy },
  { name: "Calendar", href: "/slate/calendar", icon: Calendar },
  { name: "Contracts", href: "/slate/contracts", icon: FileSignature },
  { name: "CMS", href: "/slate/cms", icon: Globe },
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
  },
  {
    name: "Federation",
    href: "/federation",
    icon: Network,
  },
];

/** All nav groups with their label and role requirement */
export const navGroups = [
  { label: "Writing", items: writingNavigation, role: null },
  { label: "Editorial", items: editorialNavigation, role: "editor" as const },
  {
    label: "Production",
    items: productionNavigation,
    role: "production" as const,
  },
  {
    label: "Business",
    items: businessNavigation,
    role: "business_ops" as const,
  },
  {
    label: "Operations",
    items: operationsNavigation,
    role: "admin" as const,
  },
] as const;
