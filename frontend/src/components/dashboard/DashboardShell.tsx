"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { UnifiedDashboardFrame, DashboardNavigationItem } from "./UnifiedDashboardFrame";
import { useWorkspaceShellContext, WorkspaceShellProvider } from "./WorkspaceShellContext";
import { InstitutionalCmsProvider } from "./InstitutionalCmsContext";
import { AuthRequiredError, AuthUser, getCachedCurrentUser, getCurrentUser, logout } from "@/lib/auth";
import { getPrimaryRole, normalizeRole } from "@/lib/authority";
import { canAccessRoute, navigationForUser, ROLE_LABELS, workspaceHome, COMMON_ACCOUNT_NAVIGATION, roleOwnedHref } from "@/lib/navigation";
import { getAdminNavigation } from "@/lib/adminNavigation";
import { workspaceGet } from "@/lib/workspaceCache";
import { getErpWorkspace, getErpWorkspaceSummary } from "@/lib/erpApi";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { WorkspaceContextSelector } from "./WorkspaceContextSelector";
import { MyWorkSummaryPanel } from "./MyWorkSummaryPanel";

const WORKSPACE_QUERY_KEYS = ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"];
const ROLE_DASHBOARD_HOME_PATHS = new Set([
  "/admin", "/chairman", "/management", "/director", "/dean", "/registrar",
  "/hod", "/faculty", "/accounts", "/hr", "/admissions", "/examination",
  "/library", "/placements", "/it", "/site-content", "/student", "/parent",
  "/club-president",
]);

function preserveWorkspaceQuery(href: string, workspaceQuery: string): string {
  if (!workspaceQuery) return href;
  const separator = href.indexOf("?");
  const pathname = separator >= 0 ? href.slice(0, separator) : href;
  const params = new URLSearchParams(separator >= 0 ? href.slice(separator + 1) : "");
  new URLSearchParams(workspaceQuery).forEach((value, key) => params.set(key, value));
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
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
  const searchParams = useSearchParams();
  const workspaceShell = useWorkspaceShellContext();
  const embeddedInWorkspaceShell = Boolean(workspaceShell) && !forceShell;
  const cachedUser = getCachedCurrentUser();
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  // A cached user is useful for instant rendering, but must never be the
  // final authorization decision. Permissions/entitlements can change after
  // RBAC sync, so route guards wait for one fresh /auth/me reconciliation.
  const [routeAuthReady, setRouteAuthReady] = useState(false);
  const [verifiedPathname, setVerifiedPathname] = useState<string | null>(null);
  const [authCheckError, setAuthCheckError] = useState("");
  const [authRetryCount, setAuthRetryCount] = useState(0);
  const [institutionBrand, setInstitutionBrand] = useState<{ name: string; logoUrl: string | null }>({ name: "", logoUrl: null });
  const [adminDepartments, setAdminDepartments] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const allowedRolesKey = allowedRoles?.join(",") || "";
  const workspaceQuery = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of WORKSPACE_QUERY_KEYS) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [searchParams]);

  const workspaceRole = useMemo(() => user ? getPrimaryRole(user.roles) : null, [user]);

  useEffect(() => {
    if (embeddedInWorkspaceShell) return;
    let alive = true;
    const requestedPathname = pathname;
    setRouteAuthReady(false);
    setAuthCheckError("");

    const cached = getCachedCurrentUser();
    if (cached) setUser(cached);

    // Authorization is tied to the destination pathname. A previously
    // verified user's permissions must never authorize a different route
    // after client navigation until a fresh /auth/me response is available.
    // The render gate and route guard also compare verifiedPathname so the
    // previous path's state cannot redirect the new path during the effect gap.
    const reconcile = getCurrentUser({ force: true });

    reconcile.then((current) => {
      if (!alive) return;
      setUser(current);
      setVerifiedPathname(requestedPathname);
      setAuthCheckError("");
      setRouteAuthReady(true);
    }).catch((error) => {
      if (!alive) return;
      if (error instanceof AuthRequiredError) {
        setUser(null);
        setVerifiedPathname(null);
        router.replace("/login");
        return;
      }
      // Fail closed on stale authorization while remaining recoverable when
      // the identity service is temporarily unavailable.
      setVerifiedPathname(null);
      setAuthCheckError("We couldn't verify your current workspace permissions. Check your connection and retry.");
      setRouteAuthReady(false);
    });
    return () => { alive = false; };
  }, [router, pathname, embeddedInWorkspaceShell, authRetryCount]);

  // Institutional branding is supplied by WorkspaceContextSelector, which also
  // owns the current academic-context request and avoids a duplicate context fetch.

  // Prefetch only after identity/active workspace resolution. Starting this
  // request from allowedRoles before /auth/me resolves can race the page-level
  // request, consume its first failure, and render inconsistent retry state.
  // The effective workspace role also prevents a route's allowedRoles from
  // prefetching data for a secondary role the authenticated user does not own.
  useEffect(() => {
    if (embeddedInWorkspaceShell || !routeAuthReady || !user || !workspaceRole) return;

    if (workspaceRole === "INSTITUTION_ADMIN") {
      void getErpWorkspace().catch(() => undefined);
      return;
    }

    if (
      workspaceRole === "CHAIRMAN" ||
      workspaceRole === "DIRECTOR" ||
      workspaceRole === "DEAN"
    ) {
      void getErpWorkspaceSummary().catch(() => undefined);
    }
  }, [embeddedInWorkspaceShell, routeAuthReady, user, workspaceRole]);

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
    // Do not evaluate route authorization with a cache verified for a different
    // pathname. The reconciliation effect will unlock this guard only after
    // the current destination's /auth/me request has completed successfully.
    if (!user || !routeAuthReady || (!embeddedInWorkspaceShell && verifiedPathname !== pathname)) return;
    const roles = user.roles?.length ? user.roles : allowedRoles || [];
    const primaryRole = getPrimaryRole(roles);
    if (allowedRoles?.length &&
        !allowedRoles.some((role) => normalizeRole(role) === primaryRole)) {
      router.replace(workspaceHome(roles));
      return;
    }
    if (embeddedInWorkspaceShell) return;
    if (!routeIsAllowedForRole(pathname, primaryRole, roles, user.permissions || [], user.tenantFeatures || [])) router.replace(workspaceHome(roles));
  }, [pathname, router, user, routeAuthReady, verifiedPathname, allowedRolesKey, embeddedInWorkspaceShell]);

  const navigation = useMemo<DashboardNavigationItem[]>(() => {
    if (!user) return [];
    if (workspaceRole === "INSTITUTION_ADMIN") {
      const base = getAdminNavigation(user).map((item) => {
        const href = preserveWorkspaceQuery(item.href, workspaceQuery);
        return { id: href, label: item.label, href, icon: item.icon, group: item.group, activeMatch: item.activeMatch };
      });
      const departmentItems = adminDepartments.map((department) => {
        const href = preserveWorkspaceQuery(`/admin/departments/${department.id}`, workspaceQuery);
        return {
          id: href,
          label: department.name,
          href,
          icon: "academic",
          group: "Departments",
        };
      });
      const accountHref = preserveWorkspaceQuery(COMMON_ACCOUNT_NAVIGATION.href, workspaceQuery);
      return [...base.filter((item) => item.group !== "Academic structure"), ...departmentItems, { id: accountHref, label: COMMON_ACCOUNT_NAVIGATION.label, href: accountHref, icon: COMMON_ACCOUNT_NAVIGATION.icon, group: COMMON_ACCOUNT_NAVIGATION.group, activeMatch: COMMON_ACCOUNT_NAVIGATION.activeMatch }];
    }
    const role = workspaceRole;
    if (!role) return [];
    const roleItems = navigationForUser({ roles: [role], permissions: user.permissions || [], tenantFeatures: user.tenantFeatures || [] }).map((item) => {
      const href = preserveWorkspaceQuery(roleOwnedHref(role, item.href), workspaceQuery);
      return { id: href, label: item.label, href, icon: item.icon, group: item.group || "Workspace", activeMatch: item.activeMatch, activeQuery: item.activeQuery };
    });
    // Role-specific route rewrites happen after canonical navigation deduplication.
    // Deduplicate final destinations too, so one page can never get duplicate buttons.
    const uniqueDestinations = new Map<string, typeof roleItems[number]>();
    for (const item of roleItems) {
      const destination = item.href.replace(/\/+$/, "") || "/";
      if (!uniqueDestinations.has(destination)) uniqueDestinations.set(destination, item);
    }
    return Array.from(uniqueDestinations.values());
  }, [adminDepartments, user, workspaceRole, workspaceQuery]);

  if (!embeddedInWorkspaceShell && authCheckError) {
    return (
      <main role="alert" aria-live="assertive" className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-start justify-center gap-4 p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Workspace verification unavailable</h1>
        <p className="text-sm text-slate-600">{authCheckError}</p>
        <button
          type="button"
          onClick={() => setAuthRetryCount((attempt) => attempt + 1)}
          className="acadlyx-button acadlyx-button-primary"
        >
          Retry verification
        </button>
      </main>
    );
  }

  if (!user || (!embeddedInWorkspaceShell && (!routeAuthReady || verifiedPathname !== pathname))) {
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
    <WorkspaceShellProvider kind="dashboard"><InstitutionalCmsProvider><a href="#acadlyx-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Skip to main content</a><main id="acadlyx-main-content" tabIndex={-1} className="acadlyx-workspace-content min-w-0 outline-none"><GlobalSearchBar />{workspaceRole !== "SUPER_ADMIN" && !pathname.startsWith("/accounts") ? <WorkspaceContextSelector onInstitutionBrand={setInstitutionBrand} /> : null}{workspaceRole !== "SUPER_ADMIN" && ROLE_DASHBOARD_HOME_PATHS.has(pathname) ? <MyWorkSummaryPanel /> : null}{children}</main></InstitutionalCmsProvider></WorkspaceShellProvider>
  </UnifiedDashboardFrame>;
}
