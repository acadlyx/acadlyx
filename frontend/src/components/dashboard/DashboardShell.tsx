"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  UnifiedDashboardFrame,
  DashboardNavigationItem,
} from "./UnifiedDashboardFrame";
import { useWorkspaceShellContext } from "./WorkspaceShellContext";
import { apiUrl } from "@/lib/api";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

import { getCanonicalRoles, getPrimaryRole, normalizeRole } from "@/lib/authority";

import {
  canAccessRoute,
  navigationForUser,
  ROLE_LABELS,
  workspaceHome,
} from "@/lib/navigation";

function matches(
  pathname: string,
  href: string,
) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function DashboardShell({
  title,
  subtitle,
  children,
  allowedRoles,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  allowedRoles?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceShell = useWorkspaceShellContext();
  const embeddedInWorkspaceShell =
    workspaceShell?.kind === "admin";

  const cachedUser =
    getCachedCurrentUser();

  const [user, setUser] =
    useState<AuthUser | null>(
      cachedUser,
    );

  const [institutionBrand, setInstitutionBrand] = useState<{ name: string; logoUrl: string | null }>({ name: "", logoUrl: null });

  const allowedRolesKey =
    allowedRoles?.join(",") || "";

  useEffect(() => {
    if (embeddedInWorkspaceShell) {
      return;
    }

    let alive = true;

    const cached =
      getCachedCurrentUser();

    if (cached) {
      setUser(cached);
    }

    fetch(apiUrl("/workspace/context"), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("acadlyx_access_token") || ""}`,
      },
    })
      .then((response) => response.ok ? response.json() : null)
      .then((response) => {
        const institution = response?.data?.institution;
        if (institution) {
          setInstitutionBrand({
            name: institution.name || "",
            logoUrl: institution.logoUrl || null,
          });
        }
      })
      .catch(() => undefined);

    getCurrentUser({
      background: Boolean(cached),
    })
      .then((current) => {
        if (!alive) {
          return;
        }

        setUser(current);
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (
          error instanceof
          AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }
      });

    return () => {
      alive = false;
    };
  }, [router, embeddedInWorkspaceShell]);

  useEffect(() => {
    if (embeddedInWorkspaceShell || !user) {
      return;
    }

    const roles =
      user.roles?.length
        ? user.roles
        : allowedRoles || [];

    if (allowedRoles?.length) {
      const canonicalRoles = getCanonicalRoles(roles);
      const pageAllowed = allowedRoles.some((role) =>
        canonicalRoles.includes(normalizeRole(role)),
      );

      if (!pageAllowed) {
        router.replace(workspaceHome(roles));
        return;
      }
    }

    if (
      !canAccessRoute(
        pathname,
        roles,
        user?.permissions || [],
      )
    ) {
      router.replace(
        workspaceHome(roles),
      );
    }
  }, [
    pathname,
    router,
    user,
    allowedRolesKey,
    embeddedInWorkspaceShell,
  ]);

  /*
   * The sidebar belongs to the authenticated workspace, not to the
   * individual page being viewed. allowedRoles is only a route guard. Using it to derive navigation
   * caused the sidebar to change whenever a user opened a page whose
   * wrapper declared a different allowed role.
   */
  const workspaceRole =
    useMemo(() => {
      if (!user) {
        return null;
      }

      return getPrimaryRole(user.roles);
    }, [user]);

  const navigation =
    useMemo<DashboardNavigationItem[]>(
      () =>
        navigationForUser(
          workspaceRole
            ? {
                roles: [workspaceRole],
                permissions:
                  user?.permissions || [],
              }
            : user,
        ).map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          group:
            item.group ||
            "Workspace",
        })),
      [user, workspaceRole],
    );

  const roles =
    user?.roles?.length
      ? user.roles
      : allowedRoles || [];

  const role =
    getPrimaryRole(roles);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  if (embeddedInWorkspaceShell) {
    return <>{children}</>;
  }

  return (
    <UnifiedDashboardFrame
      title={title}
      subtitle={subtitle}
      navigation={navigation}
      userName={
        user
          ? `${user.firstName} ${user.lastName}`.trim()
          : "Workspace"
      }
      institutionName={institutionBrand.name}
      logoUrl="/branding/acadlyx-logo.png"
      institutionLogoUrl={institutionBrand.logoUrl}
      userRole={
        role
          ? ROLE_LABELS[role] ||
            role.replace(
              /_/g,
              " ",
            )
          : undefined
      }
      onSignOut={signOut}
    >
      <InstitutionalCmsProvider>
        <div className="acadlyx-workspace-content">
          {children}
        </div>
      </InstitutionalCmsProvider>
    </UnifiedDashboardFrame>
  );
}

