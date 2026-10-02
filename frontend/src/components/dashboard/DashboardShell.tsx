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
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

import { getPrimaryRole } from "@/lib/authority";

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

  const cachedUser =
    getCachedCurrentUser();

  const [user, setUser] =
    useState<AuthUser | null>(
      cachedUser,
    );


  const allowedRolesKey =
    allowedRoles?.join(",") || "";

  useEffect(() => {
    let alive = true;

    const cached =
      getCachedCurrentUser();

    if (cached) {
      setUser(cached);
    }

    getCurrentUser({
      background: Boolean(cached),
    })
      .then((current) => {
        if (!alive) {
          return;
        }

        setUser(current);
        setAuthLoading(false);
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

        setAuthLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const roles =
      user.roles?.length
        ? user.roles
        : allowedRoles || [];

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
      <div className="space-y-5">
        {children}
      </div>
    </UnifiedDashboardFrame>
  );
}

