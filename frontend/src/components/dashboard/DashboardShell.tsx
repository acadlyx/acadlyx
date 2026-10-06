"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { UnifiedDashboardFrame, DashboardNavigationItem } from "./UnifiedDashboardFrame";
import { useWorkspaceShellContext } from "./WorkspaceShellContext";
import { InstitutionalCmsProvider } from "./InstitutionalCmsContext";
import { AuthRequiredError, AuthUser, getCachedCurrentUser, getCurrentUser, logout } from "@/lib/auth";
import { getCanonicalRoles, getPrimaryRole, normalizeRole } from "@/lib/authority";
import { canAccessRoute, navigationForUser, ROLE_LABELS, workspaceHome, COMMON_ACCOUNT_NAVIGATION } from "@/lib/navigation";
import { getAdminNavigation } from "@/lib/adminNavigation";
import { workspaceGet } from "@/lib/workspaceCache";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { WorkspaceContextHeader } from "./WorkspaceContextHeader";

const ROLE_ROUTE_OVERRIDES: Record<string, Record<string, string>> = {
  CHAIRMAN: { "/reports": "/chairman/reports", "/examinations": "/chairman/examinations" },
  DIRECTOR: { "/reports": "/director/reports", "/erp": "/director/operations", "/examinations": "/director/examinations", "/fees": "/director/fees" },
  DEAN: { "/reports": "/dean/reports", "/erp": "/dean/operations", "/examinations": "/dean/examinations", "/fees": "/dean/fees" },
  REGISTRAR: { "/reports": "/registrar/reports", "/erp": "/registrar/academic-masters" },
  HOD: { "/erp": "/hod/operations" },
  FACULTY: { "/erp": "/faculty/operations" },
  STAFF: { "/erp": "/staff/operations" },
  EXAMINATION: { "/examinations": "/examination" },
};

function roleOwnedHref(role: string | null, href: string): string {
  return ROLE_ROUTE_OVERRIDES[role || ""]?.[href] || href;
}

function routeIsAllowedForRole(pathname: string, role: string | null, roles: string[], permissions: string[], tenantFeatures: string[]): boolean {
  if (canAccessRoute(pathname, roles, permissions, tenantFeatures)) return true;
  const overrides = ROLE_ROUTE_OVERRIDES[role || ""] || {};
  const sourceRoute = Object.entries(overrides).find(([, destination]) => destination === pathname)?.[0];
  return sourceRoute ? canAccessRoute(sourceRoute, roles, permissions, tenantFeatures) : false;
}

export function DashboardShell({ title, subtitle, children, allowedRoles }: { title: string; subtitle?: string; children: ReactNode; allowedRoles?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceShell = useWorkspaceShellContext();
  const embeddedInWorkspaceShell = workspaceShell?.kind === "admin";
  const cachedUser = getCachedCurrentUser();
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [institutionBrand, setInstitutionBrand] = useState<{ name: string; logoUrl: string | null }>({ name: "", logoUrl: null });
  const [workspaceContext, setWorkspaceContext] = useState<{ breadcrumbs?: Array<{ type: string; id: string; label: string; href: string }> } | null>(null);
  const [adminDepartments, setAdminDepartments] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const allowedRolesKey = allowedRoles?.join(",") || "";

  const workspaceRole = useMemo(() => user ? getPrimaryRole(user.roles) : null, [user]);

  useEffect(() => {
    if (embeddedInWorkspaceShell) return;
    let alive = true;
    const cached = getCachedCurrentUser();
    if (cached) setUser(cached);

    getCurrentUser({ background: Boolean(cached) }).then(async (current) => {
      if (!alive) return;
      setUser(current);
      try {
        const response = await workspaceGet<{ data?: { institution?: { name?: string; logoUrl?: string | null }; breadcrumbs?: Array<{ type: string; id: string; label: string; href: string }> } }>("/workspace/context");
        const institution = response?.data?.institution;
        if (alive) setWorkspaceContext({ breadcrumbs: response?.data?.breadcrumbs || [] });
        if (alive && institution) {
          setInstitutionBrand({
            name: institution.name || "",
            logoUrl: institution.logoUrl || null,
          });
        }
      } catch {
        // Branding is non-critical.
      }
    }).catch((error) => {
      if (alive && error instanceof AuthRequiredError) router.replace("/login");
    });
    return () => { alive = false; };
  }, [router, embeddedInWorkspaceShell]);

  useEffect(() => {
    if (embeddedInWorkspaceShell || workspaceRole !== "INSTITUTION_ADMIN") return;
    let alive = true;
    workspaceGet<{ data?: Array<{ id: string; name: string; code?: string }> }>("/departments?page=1&pageSize=100&isActive=true")
      .then((response) => {
        if (alive) setAdminDepartments(response?.data || []);
      })
      .catch(() => {
        if (alive) setAdminDepartments([]);
      });
    return () => { alive = false; };
  }, [embeddedInWorkspaceShell, workspaceRole]);

  useEffect(() => {
    if (embeddedInWorkspaceShell || !user) return;

    const roles = user.roles?.length ? user.roles : allowedRoles || [];
    const home = workspaceHome(roles);
    const timer = window.setTimeout(() => {
      router.prefetch(home);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [router, user, allowedRolesKey, embeddedInWorkspaceShell]);

  useEffect(() => {
    if (embeddedInWorkspaceShell || !user) return;
    const roles = user.roles?.length ? user.roles : allowedRoles || [];
    const primaryRole = getPrimaryRole(roles);
    if (allowedRoles?.length) {
      const canonicalRoles = getCanonicalRoles(roles);
      if (!allowedRoles.some((role) => canonicalRoles.includes(normalizeRole(role)))) {
        router.replace(workspaceHome(roles));
        return;
      }
    }
    if (!routeIsAllowedForRole(pathname, primaryRole, roles, user.permissions || [], user.tenantFeatures || [])) router.replace(workspaceHome(roles));
  }, [pathname, router, user, allowedRolesKey, embeddedInWorkspaceShell]);

  const navigation = useMemo<DashboardNavigationItem[]>(() => {
    if (!user) return [];
    if (workspaceRole === "INSTITUTION_ADMIN") {
      const base = getAdminNavigation(user).map((item) => ({ id: item.href, label: item.label, href: item.href, icon: item.icon, group: item.group, activeMatch: item.activeMatch }));
      const departmentItems = adminDepartments.map((department) => ({
        id: `/admin/departments/${department.id}`,
        label: department.name,
        href: `/admin/departments/${department.id}`,
        icon: "academic",
        group: "Departments",
      }));
      return [...base.filter((item) => item.group !== "Academic structure"), ...departmentItems, { id: COMMON_ACCOUNT_NAVIGATION.href, label: COMMON_ACCOUNT_NAVIGATION.label, href: COMMON_ACCOUNT_NAVIGATION.href, icon: COMMON_ACCOUNT_NAVIGATION.icon, group: COMMON_ACCOUNT_NAVIGATION.group, activeMatch: COMMON_ACCOUNT_NAVIGATION.activeMatch }];
    }
    const role = workspaceRole;
    if (!role) return [];
    return navigationForUser({ roles: [role], permissions: user.permissions || [], tenantFeatures: user.tenantFeatures || [] }).map((item) => {
      const href = roleOwnedHref(role, item.href);
      return { id: href, label: item.label, href, icon: item.icon, group: item.group || "Workspace", activeMatch: item.activeMatch, activeQuery: item.activeQuery };
    });
  }, [adminDepartments, user, workspaceRole]);

  if (!user) return null;

  const roles = user.roles?.length ? user.roles : allowedRoles || [];
  const role = getPrimaryRole(roles);
  async function signOut() { await logout(); router.replace("/login"); }

  if (embeddedInWorkspaceShell) return <>{children}</>;

  return <UnifiedDashboardFrame title={title} subtitle={subtitle} navigation={navigation} userName={`${user.firstName} ${user.lastName}`.trim() || "Workspace"} institutionName={institutionBrand.name} logoUrl="/branding/acadlyx-logo.png" institutionLogoUrl={institutionBrand.logoUrl} userRole={role ? ROLE_LABELS[role] || role.replace(/_/g, " ") : undefined} onSignOut={signOut}>
    <InstitutionalCmsProvider><a href="#acadlyx-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Skip to main content</a><main id="acadlyx-main-content" tabIndex={-1} className="acadlyx-workspace-content min-w-0 outline-none"><GlobalSearchBar />{workspaceContext?.breadcrumbs?.length ? <WorkspaceContextHeader breadcrumbs={workspaceContext.breadcrumbs} /> : null}{children}</main></InstitutionalCmsProvider>
  </UnifiedDashboardFrame>;
}
