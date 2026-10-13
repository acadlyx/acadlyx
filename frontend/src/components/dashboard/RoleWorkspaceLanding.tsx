"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { AccessNotice } from "@/components/dashboard/AccessNotice";
import { SvgIcon } from "@/components/dashboard/UnifiedDashboardFrame";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  AuthUser,
  authedFetch,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";

import {
  hasAnyPermission,
  normalizeRoles,
  type CanonicalRole,
} from "@/lib/authorization";

import {
  ROLE_NAVIGATION,
  WORKSPACE_META,
  getPrimaryRole,
} from "./dashboardNavigation";

function toCanonicalRoles(
  roles: readonly string[],
): CanonicalRole[] {
  const normalized =
    normalizeRoles(roles);

  return normalized.filter(
    (
      role,
    ): role is CanonicalRole =>
      Object.prototype.hasOwnProperty.call(
        WORKSPACE_META,
        role,
      ),
  );
}

function flattenNavigation(
  role: CanonicalRole,
) {
  return ROLE_NAVIGATION[
    role
  ].flatMap((group) =>
    group.items.map(
      (item) => ({
        ...item,
        group: group.label,
      }),
    ),
  );
}

export function RoleWorkspaceLanding({
  role,
}: {
  role: CanonicalRole;
}) {
  const router =
    useRouter();

  const [user, setUser] =
    useState<AuthUser | null>(
      getCachedCurrentUser(),
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    getCurrentUser({
      background: Boolean(
        getCachedCurrentUser(),
      ),
    })
      .then((current) => {
        if (mounted) {
          setUser(current);
        }
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }

        if (
          err instanceof
          AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your workspace.",
        );
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const currentRole =
    useMemo<CanonicalRole | null>(
      () => {
        if (!user) {
          return role;
        }

        const canonicalRoles =
          toCanonicalRoles(
            user.roles,
          );

        // A user may hold multiple authorized workspaces. Keep the
        // requested workspace when the account actually owns it instead
        // of always redirecting to the primary role.
        if (canonicalRoles.includes(role)) {
          return role;
        }

        return getPrimaryRole(
          canonicalRoles,
        );
      },
      [role, user],
    );

  useEffect(() => {
    if (
      !currentRole ||
      currentRole === role
    ) {
      return;
    }

    const target =
      WORKSPACE_META[
        currentRole
      ]?.home;

    if (target) {
      router.replace(target);
    }
  }, [
    currentRole,
    role,
    router,
  ]);

  const [workspaceStats, setWorkspaceStats] =
    useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || !currentRole) {
      return;
    }

    let mounted = true;

    authedFetch<{
      success: true;
      data: {
        stats?: Record<string, number>;
      };
    }>("/erp/me/workspace")
      .then((response) => {
        if (mounted) {
          setWorkspaceStats(response.data.stats ?? {});
        }
      })
      .catch((err) => {
        if (
          mounted &&
          err instanceof AuthRequiredError
        ) {
          router.replace("/login");
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentRole, router, user]);

  const statEntries = Object.entries(workspaceStats)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .slice(0, 6);

  if (
    currentRole &&
    currentRole !== role
  ) {
    return null;
  }

  const meta =
    WORKSPACE_META[role];

  const available =
    user
      ? flattenNavigation(
          role,
        ).filter(
          (item) =>
            !item.permissions
              ?.length ||
            hasAnyPermission(
              user,
              item.permissions,
            ),
        )
      : [];

  const groups =
    ROLE_NAVIGATION[role]
      .map((group) => ({
        ...group,
        items:
          group.items.filter(
            (item) =>
              !item.permissions
                ?.length ||
              Boolean(
                user &&
                  hasAnyPermission(
                    user,
                    item.permissions,
                  ),
              ),
          ),
      }))
      .filter(
        (group) =>
          group.items.length >
          0,
      );

  return (
    <DashboardShell
      title={meta.title}
      subtitle={meta.subtitle}
      allowedRoles={[role]}
    >
      <div className="space-y-6">
        {error ? (
          <AccessNotice
            title="We could not load your workspace"
            message="Your sign-in is still active. Refresh the page or return to your workspace and try again."
            href={meta.home}
            actionLabel="Return to workspace"
          />
        ) : null}

        {statEntries.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Live snapshot
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                Current workspace activity
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {statEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                    {key.replaceAll(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {Number(value).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Available work
            </p>

            <h3 className="mt-1 text-xl font-black text-slate-900">
              Everything assigned to this workspace
            </h3>

          </div>

          <div className="space-y-6">
            {groups.map(
              (group) => (
                <div
                  key={group.label}
                >
                  <h4 className="mb-3 text-sm font-black text-slate-800">
                    {group.label}
                  </h4>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map(
                      (item) => (
                        <Link
                          key={`${item.href}:${item.label}`}
                          href={item.href}
                          className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-600">
                            <SvgIcon name={item.icon} className="h-4 w-4" />
                          </span>

                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-slate-900">
                              {item.label}
                            </span>

                          </span>
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
