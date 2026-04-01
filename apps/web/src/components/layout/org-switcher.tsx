"use client";

import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { useOrganization } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const roleColors: Record<string, string> = {
  ADMIN: "bg-status-error/10 text-status-error",
  EDITOR: "bg-status-info/10 text-status-info",
  PRODUCTION: "bg-status-held/10 text-status-held",
  BUSINESS_OPS: "bg-status-warning/10 text-status-warning",
  READER: "bg-status-info/10 text-status-info",
};

export function OrgSwitcher() {
  const { currentOrg, organizations, switchOrganization, isAdmin } =
    useOrganization();

  if (organizations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-auto sm:w-[200px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">
              {currentOrg?.name ?? "Select organization"}
            </span>
          </div>
          <ChevronsUpDown className="hidden sm:block h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="end">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.id)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {currentOrg?.id === org.id && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "truncate",
                    currentOrg?.id !== org.id && "ml-6",
                  )}
                >
                  {org.name}
                </span>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs flex-shrink-0",
                  roleColors[org.roles[0]],
                )}
              >
                {org.roles[0].toLowerCase()}
                {org.roles.length > 1 && ` +${org.roles.length - 1}`}
              </Badge>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/organizations/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Org Settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/organizations/new" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
