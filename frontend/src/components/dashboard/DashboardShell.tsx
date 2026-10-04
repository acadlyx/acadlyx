"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { UnifiedDashboardFrame, DashboardNavigationItem } from "./UnifiedDashboardFrame";
import { useWorkspaceShellContext } from "./WorkspaceShellContext";
import { InstitutionalCmsProvider } from "./InstitutionalCmsContext";
import { apiUrl } from "@/lib/api";
import { AuthRequiredError, AuthUser, getCachedCurrentUser, getCurrentUser, logout } from "@/lib/auth";
import { getCanonicalRoles, getPrimaryRole, normalizeRole } from "@/lib/authority";
import { canAccessRoute, navigationForUser, ROLE_LABELS, workspaceHome } from "@/lib/navigation";
import { getAdminNavigation } from "@/lib/adminNavigation";

const ROLE_ROUTE_OVERRIDES: Record<string, Record<string, string>> = {
  CHAIRMAN: { "/reports": "/chairman/reports" },
  DIRECTOR: { "/reports": "/director/reports", "/erp": "/director/operations" },
  DEAN: { "/reports": "/dean/reports", "/erp": "/dean/operations" },
  REGISTRAR: { "/reports": "/registrar/reports", "/erp": "/registrar/academic-masters" },
  HOD: { "/erp": "/hod/operations" },
  STAFF: { "/erp": "/staff/operations" },
};

function roleOwnedHref(role: string | null, href: string): string {
  return ROLE_ROUTE_OVERRIDES[role || ""]?.[href] || href;
}

export function DashboardShell({ title, subtitle, children, allowedRoles }: { title: string; subtitle?: string; children: ReactNode; allowedRoles?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceShell = useWorkspaceShellContext();
  const embeddedInWorkspaceShell = workspaceShell?.kind === "admin";
  const cachedUser = getCachedCurrentUser();
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [institutionBrand, setInstitutionBrand] = useState<{ name: string; logoUrl: string | null }>({ name: "", logoUrl: null });
  const allowedRolesKey = allowedRoles?.join(",") || "";

  useEffect(() => {
    if (embeddedInWorkspaceShell) return;
    let alive = true;
    const cached = getCachedCurrentUser();
    if (cached) setUser(cached);
    fetch(apiUrl("/workspace/context"), { headers: { Authorization: `Bearer ${localStorage.getItem("acadlyx_access_token") || ""}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((response) => {
        const institution = response?.data?.institution;
        if (institution && alive) setInstitutionBrand({ name: institution.name || "", logoUrl: institution.logoUrl || null });
      })
      .catch(() => undefined);
    getCurrentUser({ background: Boolean(cached) }).then((current) => { if (alive) setUser(current); }).catch((error) => {
      if (alive && error instanceof AuthRequiredError) router.replace("/login");
    });
    return () => { alive = false; };
  }, [router, embeddedInWorkspaceShell]);

  useEffect(() => {
    if (embeddedInWorkspaceShell || !user) return;
    const roles = user.roles?.length ? user.roles : allowedRoles || [];
    if (allowedRoles?.length) {
      const canonicalRoles = getCanonicalRoles(roles);
      if (!allowedRoles.some((role) => canonicalRoles.includes(normalizeRole(role)))) {
        router.replace(workspaceHome(roles));
        return;
      }
    }
    if (!canAccessRoute(pathname, roles, user.permissions || [])) router.replace(workspaceHome(roles));
  }, [pathname, router, user, allowedRolesKey, embeddedInWorkspaceShell]);

  const workspaceRole = useMemo(() => user ? getPrimaryRole(user.roles) : null, [user]);

  const navigation = useMemo<DashboardNavigationItem[]>(() => {
    if (!user) return [];
    if (workspaceRole === "INSTITUTION_ADMIN") {
      return getAdminNavigation(user).map((item) => ({ id: item.href, label: item.label, href: item.href, icon: item.icon, group: item.group }));
    }

    const role = workspaceRole;
    if (!role) return [];

    return navigationForUser({
      roles: [role],
      permissions: user.permissions || [],
    }).map((item) => {
      const href = roleOwnedHref(role, item.href);
      return {
        id: href,
        label: item.label,
        href,
        icon: item.icon,
        group: item.group || "Workspace",
      };
    });
  }, [user, workspaceRole]);

  const roles = user?.roles?.length ? user.roles : allowedRoles || [];
  const role = getPrimaryRole(roles);
  async function signOut() { await logout(); router.replace("/login"); }

  if (embeddedInWorkspaceShell) return <>{children}</>;

  return <UnifiedDashboardFrame title={title} subtitle={subtitle} navigation={navigation} userName={user ? `${user.firstName} ${user.lastName}`.trim() : "Workspace"} institutionName={institutionBrand.name} logoUrl="/branding/acadlyx-logo.png" institutionLogoUrl={institutionBrand.logoUrl} userRole={role ? ROLE_LABELS[role] || role.replace(/_/g, " ") : undefined} onSignOut={signOut}>
    <InstitutionalCmsProvider><div className="acadlyx-workspace-content">{children}</div></InstitutionalCmsProvider>
  </UnifiedDashboardFrame>;
}
