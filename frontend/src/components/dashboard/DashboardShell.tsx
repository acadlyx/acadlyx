"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { UnifiedDashboardFrame, DashboardNavigationItem } from "./UnifiedDashboardFrame";
import { useWorkspaceShellContext, WorkspaceShellProvider } from "./WorkspaceShellContext";
import { InstitutionalCmsProvider } from "./InstitutionalCmsContext";
import { AuthRequiredError, AuthUser, getCachedCurrentUser, getCurrentUser, logout } from "@/lib/auth";
import { getPrimaryRole, normalizeRole } from "@/lib/authority";
import { canAccessRoute, navigationForUser, ROLE_LABELS, workspaceHome, COMMON_ACCOUNT_NAVIGATION } from "@/lib/navigation";
import { getAdminNavigation } from "@/lib/adminNavigation";
import { workspaceGet } from "@/lib/workspaceCache";
import { getErpWorkspace, getErpWorkspaceSummary } from "@/lib/erpApi";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { WorkspaceContextHeader } from "./WorkspaceContextHeader";

const ROLE_ROUTE_OVERRIDES: Record<string, Record<string, string>> = {
  CHAIRMAN: { "/reports": "/chairman/reports", "/examinations": "/chairman/examinations", "/fees": "/chairman/fees", "/fees/structures": "/chairman/fees/structures", "/fees/collections": "/chairman/fees/collections", "/students": "/chairman/students", "/operations": "/chairman/operations", "/chairman/notices": "/chairman/notices", "/chairman/notifications": "/chairman/notifications", "/chairman/events-gallery": "/chairman/events-gallery" },
  DIRECTOR: { "/reports": "/director/reports", "/erp": "/director/operations", "/examinations": "/director/examinations", "/examinations/operations": "/director/examinations/operations", "/fees": "/director/fees", "/fees/collections": "/director/fees/collections", "/students": "/director/students", "/intelligence": "/director/intelligence", "/admissions": "/director/admissions", "/notices": "/director/notices", "/notifications": "/director/notifications", "/events-gallery": "/director/events-gallery", "/placements": "/director/placements", "/obe": "/director/obe" },
  DEAN: { "/reports": "/dean/reports", "/erp": "/dean/operations", "/examinations": "/dean/examinations", "/fees": "/dean/fees", "/fees/collections": "/dean/fees", "/students": "/dean/students" },
  REGISTRAR: { "/reports": "/registrar/reports", "/erp": "/registrar/academic-masters", "/students": "/registrar/students" },
  HOD: { "/erp": "/hod/operations", "/fees": "/hod/fees", "/fees/collections": "/hod/fees", "/attendance": "/hod/attendance", "/students": "/hod/students", "/timetable": "/hod/timetable", "/reports": "/hod/reports", "/intelligence": "/hod/intelligence" },
  FACULTY: { "/erp": "/faculty/operations" },
  HR: { "/reports": "/hr/reports" },
  STAFF: { "/erp": "/staff/operations" },
  MANAGEMENT: { "/operations": "/management/operations", "/intelligence": "/management/intelligence", "/reports": "/management/reports" },
  EXAMINATION: { "/examinations": "/examination", "/reports": "/examination/reports" },  ADMISSIONS: { "/reports": "/admissions/reports", "/students": "/admissions/students" },  LIBRARIAN: { "/reports": "/library/reports", "/students": "/library/students" },  PLACEMENT: { "/reports": "/placements/reports", "/students": "/placements/students" },
};

function roleOwnedHref(role: string | null, href: string): string {
  return ROLE_ROUTE_OVERRIDES[role || ""]?.[href] || href;
}

function routeIsAllowedForRole(pathname: string, _role: string | null, roles: string[], permissions: string[], tenantFeatures: string[]): boolean {
  // Check the destination's own role and permission contract. Mapping a
  // role-owned page back to a generic source route caused redirects whenever
  // that generic route belonged to another workspace.
  return canAccessRoute(pathname, roles, permissions, tenantFeatures);
}

export function DashboardShell({ title, subtitle, children, allowedRoles, forceShell = false }: { title: string; subtitle?: string; children: ReactNode; allowedRoles?: string[]; forceShell?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceShell = useWorkspaceShellContext();
  const embeddedInWorkspaceShell = Boolean(workspaceShell) && !forceShell;
  const cachedUser = getCachedCurrentUser();
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  // A cached user is useful for instant rendering, but must never be the
  // final authorization decision. Permissions/entitlements can change after
  // RBAC sync, so route guards wait for one fresh /auth/me reconciliation.
  const [routeAuthReady, setRouteAuthReady] = useState(!cachedUser);
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

    const reconcile = cached
      ? getCurrentUser({ force: true })
      : getCurrentUser();

    // Workspace context is independent of /auth/me. Start both requests at
    // the same time so the shell doesn't add a serial network/database trip
    // before loading breadcrumbs and institution branding.
    void workspaceGet<{
      data?: {
        institution?: { name?: string; logoUrl?: string | null };
        breadcrumbs?: Array<{ type: string; id: string; label: string; href: string }>;
      };
    }>("/workspace/context").then((response) => {
      if (!alive) return;
      const institution = response?.data?.institution;
      setWorkspaceContext({ breadcrumbs: response?.data?.breadcrumbs || [] });
      if (institution) {
        setInstitutionBrand({
          name: institution.name || "",
          logoUrl: institution.logoUrl || null,
        });
      }
    }).catch(() => {
      // Workspace context/branding is supplementary. Route authorization
      // still waits for /auth/me and the backend enforces every API scope.
    });

    reconcile.then((current) => {
      if (!alive) return;
      setUser(current);
      setRouteAuthReady(true);
    }).catch((error) => {
      if (!alive) return;
      setRouteAuthReady(true);
      if (error instanceof AuthRequiredError) router.replace("/login");
    });
    return () => { alive = false; };
  }, [router, embeddedInWorkspaceShell]);

  // Prefetch the first workspace payload alongside auth reconciliation.
  // The API independently enforces the user's real role and tenant scope; the
  // result is only rendered by the page after the shell has resolved the user.
  useEffect(() => {
    if (embeddedInWorkspaceShell) return;
    const roleNames = (allowedRoles || []).map(normalizeRole);
    if (roleNames.includes("INSTITUTION_ADMIN")) {
      void getErpWorkspace().catch(() => undefined);
      return;
    }
    if (roleNames.some((role) => ["CHAIRMAN", "DIRECTOR", "DEAN"].includes(role))) {
      void getErpWorkspaceSummary().catch(() => undefined);
    }
  }, [embeddedInWorkspaceShell, allowedRolesKey]);

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
    if (!user || !routeAuthReady) return;
    const roles = user.roles?.length ? user.roles : allowedRoles || [];
    const primaryRole = getPrimaryRole(roles);
    if (allowedRoles?.length &&
        !allowedRoles.some((role) => normalizeRole(role) === primaryRole)) {
      router.replace(workspaceHome(roles));
      return;
    }
    if (embeddedInWorkspaceShell) return;
    if (!routeIsAllowedForRole(pathname, primaryRole, roles, user.permissions || [], user.tenantFeatures || [])) router.replace(workspaceHome(roles));
  }, [pathname, router, user, routeAuthReady, allowedRolesKey, embeddedInWorkspaceShell]);

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

  if (!user) {
    return (
      <div role="status" aria-live="polite" className="min-h-[40vh] animate-pulse p-6 sm:p-8">
        <span className="sr-only">Loading your secure workspace…</span>
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-8 w-56 rounded-xl bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  const roles = user.roles?.length ? user.roles : allowedRoles || [];
  const role = getPrimaryRole(roles);
  async function signOut() { await logout(); router.replace("/login"); }

  if (embeddedInWorkspaceShell) return <>{children}</>;

  return <UnifiedDashboardFrame title={title} subtitle={subtitle} navigation={navigation} userName={`${user.firstName} ${user.lastName}`.trim() || "Workspace"} institutionName={institutionBrand.name} logoUrl="/branding/acadlyx-logo.png" institutionLogoUrl={institutionBrand.logoUrl} userRole={role ? ROLE_LABELS[role] || role.replace(/_/g, " ") : undefined} onSignOut={signOut}>
    <WorkspaceShellProvider kind="dashboard"><InstitutionalCmsProvider><a href="#acadlyx-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Skip to main content</a><main id="acadlyx-main-content" tabIndex={-1} className="acadlyx-workspace-content min-w-0 outline-none"><GlobalSearchBar />{!pathname.startsWith("/accounts") && workspaceContext?.breadcrumbs?.length ? <WorkspaceContextHeader breadcrumbs={workspaceContext.breadcrumbs} /> : null}{children}</main></InstitutionalCmsProvider></WorkspaceShellProvider>
  </UnifiedDashboardFrame>;
}
