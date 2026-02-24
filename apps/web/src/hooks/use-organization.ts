"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentOrgId, setCurrentOrgId, trpc } from "@/lib/trpc";
import { useAuth } from "./use-auth";

export type OrgRole = "ADMIN" | "EDITOR" | "READER";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

export function useOrganization() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // Get organizations from user profile
  const organizations: Organization[] = useMemo(
    () =>
      user?.organizations?.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        role: m.role,
      })) ?? [],
    [user?.organizations],
  );

  // Reactive org ID state — initialized from localStorage, updated on switch
  const [currentOrgId, _setCurrentOrgId] = useState<string | null>(() =>
    typeof window !== "undefined" ? getCurrentOrgId() : null,
  );

  // Find current organization
  const currentOrg =
    organizations.find((org) => org.id === currentOrgId) ?? null;

  // Resolve org: auto-select first org or recover from stale org (render-time)
  const needsAutoSelect =
    isAuthenticated && organizations.length > 0 && !currentOrgId;
  const isStaleOrg =
    isAuthenticated &&
    !!currentOrgId &&
    organizations.length > 0 &&
    !organizations.some((org) => org.id === currentOrgId);

  if (needsAutoSelect || isStaleOrg) {
    if (isStaleOrg) {
      console.warn("Clearing stale org context:", currentOrgId);
    }
    const firstId = organizations[0].id;
    setCurrentOrgId(firstId);
    _setCurrentOrgId(firstId);
  }

  // Invalidate cached queries when org changes (stale recovery or manual switch)
  const prevOrgIdRef = useRef(currentOrgId);
  useEffect(() => {
    const prev = prevOrgIdRef.current;
    prevOrgIdRef.current = currentOrgId;
    // Only invalidate when switching from one valid org to another (not initial select)
    if (prev && prev !== currentOrgId) {
      utils.invalidate();
    }
  }, [currentOrgId, utils]);

  // Switch organization
  const switchOrganization = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (!org) {
        console.error("Organization not found:", orgId);
        return;
      }

      setCurrentOrgId(orgId);
      _setCurrentOrgId(orgId);
    },
    [organizations],
  );

  // Role checks
  const isAdmin = currentOrg?.role === "ADMIN";
  const isEditor =
    currentOrg?.role === "EDITOR" || currentOrg?.role === "ADMIN";
  const isReader = !!currentOrg;

  return {
    user,
    currentOrg,
    organizations,
    switchOrganization,
    isAdmin,
    isEditor,
    isReader,
    hasOrganizations: organizations.length > 0,
  };
}
