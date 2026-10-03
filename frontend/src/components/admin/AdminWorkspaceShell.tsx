"use client";

import type { ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import { UnifiedDashboardFrame } from "@/components/dashboard/UnifiedDashboardFrame";
import type { DashboardNavigationItem } from "@/components/dashboard/UnifiedDashboardFrame";
import { WorkspaceShellProvider } from "@/components/dashboard/WorkspaceShellContext";

import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

import {
  canAccessAdminPath,
  getAdminNavigation,
  findAdminNavItem,
} from "@/lib/adminNavigation";

export function AdminWorkspaceShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const cachedUser =
    getCachedCurrentUser();

  const [user, setUser] =
    useState<AuthUser | null>(
      cachedUser,
    );

  const [loading, setLoading] =
    useState(!cachedUser);

  useEffect(() => {
    let alive = true;

    const cached =
      getCachedCurrentUser();

    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    getCurrentUser({
      background: Boolean(cached),
    })
      .then((currentUser) => {
        if (!alive) {
          return;
        }

        setUser(currentUser);
        setLoading(false);
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

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  /*
   * Authorization remains completely independent from navigation visibility.
   * The backend remains authoritative for every API operation.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    if (
      !canAccessAdminPath(
        user,
        pathname,
      )
    ) {
      router.replace("/admin");
    }
  }, [
    user,
    pathname,
    router,
  ]);

  const navigation =
    useMemo<DashboardNavigationItem[]>(
      () =>
        getAdminNavigation(
          user,
        ).map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          group:
            item.group ||
            "Workspace",
        })),
      [user],
    );

  const active =
    findAdminNavItem(
      pathname,
    );

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <UnifiedDashboardFrame
      title={
        active?.label ||
        "Admin Command Center"
      }
      subtitle="ACADLYX • Institution administration"
      navigation={navigation}
      userName={
        user
          ? `${user.firstName} ${user.lastName}`.trim()
          : "Workspace"
      }
      userRole="Institution Admin"
      onSignOut={signOut}
    >
      <WorkspaceShellProvider kind="admin">
        {children}
      </WorkspaceShellProvider>
    </UnifiedDashboardFrame>
  );
}
