"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";

import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

import {
  hasAnyPermission,
  normalizeRoles,
  type CanonicalRole,
} from "@/lib/authorization";

import {
  getWorkspaceHome,
  isRouteInWorkspace,
} from "./roleRouteAccess";

import {
  getPrimaryRole,
  ROLE_NAVIGATION,
  ROLE_PRIORITY,
  WORKSPACE_META,
  type NavigationGroup,
} from "./dashboardNavigation";

function isItemActive(
  pathname: string,
  href: string
): boolean {
  const [path] =
    href.split("?");

  if (pathname === path) {
    return true;
  }

  if (path === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(
    `${path}/`
  );
}

function filterGroups(
  groups: NavigationGroup[],
  user: AuthUser | null
): NavigationGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items:
        group.items.filter(
          (item) =>
            !item.permissions?.length ||
            Boolean(
              user &&
                hasAnyPermission(
                  user,
                  item.permissions
                )
            )
        ),
    }))
    .filter(
      (group) =>
        group.items.length > 0
    );
}

function Initials({
  user,
}: {
  user: AuthUser | null;
}) {
  const value = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "A";

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
      {value || "A"}
    </span>
  );
}

function toCanonicalRoles(
  roles: readonly string[]
): CanonicalRole[] {
  const normalized =
    normalizeRoles(roles);

  return normalized.filter(
    (role): role is CanonicalRole =>
      ROLE_PRIORITY.includes(
        role as CanonicalRole
      )
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
  const router =
    useRouter();

  const pathname =
    usePathname();

  /*
   * IMPORTANT PERFORMANCE FIX
   *
   * Do NOT call getCachedCurrentUser()
   * directly on every render and then place
   * the returned object in an effect dependency.
   *
   * getCachedCurrentUser() parses sessionStorage
   * and therefore returns a new object reference.
   *
   * The old pattern could repeatedly trigger:
   *
   * render
   *   -> new cached object
   *   -> auth effect
   *   -> setUser
   *   -> render
   *   -> new cached object
   *   -> auth effect
   *
   * The initial snapshot is therefore intentionally
   * read once.
   */
  const [user, setUser] =
    useState<AuthUser | null>(
      () => getCachedCurrentUser()
    );

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [collapsed, setCollapsed] =
    useState(false);

  const normalizedAllowedRoles =
    useMemo(
      () =>
        toCanonicalRoles(
          allowedRoles ?? []
        ),
      [allowedRoles]
    );

  /*
   * Authenticate exactly once when the shell
   * mounts for the current route.
   *
   * Background revalidation is handled inside
   * getCurrentUser().
   */
  useEffect(() => {
    let mounted = true;

    getCurrentUser({
      background: Boolean(user),
    })
      .then((currentUser) => {
        if (!mounted) {
          return;
        }

        const actualRoles =
          toCanonicalRoles(
            currentUser.roles
          );

        if (
          normalizedAllowedRoles.length >
            0 &&
          !normalizedAllowedRoles.some(
            (role) =>
              actualRoles.includes(
                role
              )
          )
        ) {
          const target =
            getPrimaryRole(
              actualRoles
            );

          router.replace(
            target
              ? WORKSPACE_META[
                  target
                ].home
              : "/login"
          );

          return;
        }

        setUser(currentUser);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        if (
          error instanceof
          AuthRequiredError
        ) {
          router.replace(
            "/login"
          );
        }
      });

    return () => {
      mounted = false;
    };

    /*
     * Deliberately do not depend on `user`.
     *
     * User updates must not cause the
     * authentication effect to execute again.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    normalizedAllowedRoles,
    router,
  ]);

  useEffect(() => {
    if (
      !user ||
      pathname === "/login"
    ) {
      return;
    }

    const actualRoles =
      toCanonicalRoles(
        user.roles
      );

    const actualRole =
      getPrimaryRole(
        actualRoles
      );

    if (!actualRole) {
      router.replace(
        "/login"
      );
      return;
    }

    if (
      !isRouteInWorkspace(
        actualRole,
        pathname
      )
    ) {
      router.replace(
        getWorkspaceHome(
          actualRole
        )
      );
    }
  }, [
    pathname,
    router,
    user,
  ]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previous =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [mobileOpen]);

  const primaryRole =
    useMemo(() => {
      const roles =
        user?.roles ??
        normalizedAllowedRoles;

      return getPrimaryRole(
        toCanonicalRoles(
          roles
        )
      );
    }, [
      normalizedAllowedRoles,
      user,
    ]);

  const workspace =
    primaryRole
      ? WORKSPACE_META[
          primaryRole
        ]
      : null;

  const groups =
    useMemo(() => {
      if (!primaryRole) {
        return [];
      }

      const visible =
        filterGroups(
          ROLE_NAVIGATION[
            primaryRole
          ],
          user
        );

      return visible
        .map((group) => ({
          ...group,
          items:
            group.items.filter(
              (item) =>
                isRouteInWorkspace(
                  primaryRole,
                  item.href.split(
                    "?"
                  )[0]
                )
            ),
        }))
        .filter(
          (group) =>
            group.items.length >
            0
        );
    }, [
      primaryRole,
      user,
    ]);

  async function signOut() {
    await logout();

    router.replace(
      "/login"
    );
  }

  function navigateHome() {
    if (!primaryRole) {
      return;
    }

    router.push(
      WORKSPACE_META[
        primaryRole
      ].home
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setMobileOpen(
                  (value) =>
                    !value
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg lg:hidden"
              aria-label="Open workspace navigation"
            >
              ☰
            </button>

            <button
              type="button"
              onClick={
                navigateHome
              }
              className="flex min-w-0 items-center gap-3 text-left"
              aria-label="Open workspace home"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black tracking-tight text-white">
                AX
              </span>

              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-black tracking-tight">
                  ACADLYX
                </span>

                <span className="block truncate text-[11px] font-medium text-slate-500">
                  {workspace?.label ??
                    "Workspace"}
                </span>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 md:flex">
              <Initials
                user={user}
              />

              <div className="max-w-[190px]">
                <p className="truncate text-xs font-bold text-slate-900">
                  {user
                    ? `${user.firstName} ${user.lastName}`.trim()
                    : "Loading…"}
                </p>

                <p className="truncate text-[11px] text-slate-500">
                  {user?.email ??
                    ""}
                </p>
              </div>
            </div>

            <AccountMenu />

            <button
              type="button"
              onClick={
                signOut
              }
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close workspace navigation"
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          onClick={() =>
            setMobileOpen(
              false
            )
          }
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-[72px] z-50 w-[272px] border-r border-slate-200 bg-white transition-[width,transform] duration-200 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        } ${
          collapsed
            ? "lg:w-[84px]"
            : ""
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div
            className={`mb-4 rounded-2xl bg-slate-950 p-4 text-white ${
              collapsed
                ? "lg:hidden"
                : ""
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
              Current workspace
            </p>

            <p className="mt-1 text-sm font-black">
              {workspace?.label ??
                "Workspace"}
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              {workspace?.subtitle ??
                "Your available work and tools"}
            </p>
          </div>

          <nav
            className="space-y-5"
            aria-label="Workspace navigation"
          >
            {groups.map(
              (group) => (
                <section
                  key={
                    group.label
                  }
                >
                  <p
                    className={`mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 ${
                      collapsed
                        ? "lg:hidden"
                        : ""
                    }`}
                  >
                    {
                      group.label
                    }
                  </p>

                  <div className="space-y-1">
                    {group.items.map(
                      (item) => {
                        const active =
                          isItemActive(
                            pathname,
                            item.href
                          );

                        return (
                          <Link
                            key={`${item.href}:${item.label}`}
                            href={
                              item.href
                            }
                            title={
                              collapsed
                                ? item.label
                                : undefined
                            }
                            onClick={() =>
                              setMobileOpen(
                                false
                              )
                            }
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                              collapsed
                                ? "lg:justify-center lg:px-2"
                                : ""
                            } ${
                              active
                                ? "bg-slate-950 text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
                                active
                                  ? "bg-white/15 text-white"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-white"
                              }`}
                            >
                              {
                                item.icon
                              }
                            </span>

                            <span
                              className={
                                collapsed
                                  ? "lg:hidden"
                                  : ""
                              }
                            >
                              {
                                item.label
                              }
                            </span>
                          </Link>
                        );
                      }
                    )}
                  </div>
                </section>
              )
            )}
          </nav>

          <div
            className={`mt-auto pt-5 ${
              collapsed
                ? "lg:hidden"
                : ""
            }`}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-800">
                Need help?
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Start from Overview.
                It shows the work
                that belongs to
                your responsibility.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main
        className={`min-h-screen pt-[72px] transition-[padding] duration-200 ${
          collapsed
            ? "lg:pl-[84px]"
            : "lg:pl-[272px]"
        }`}
      >
        <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1500px]">
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                  {workspace ? (
                    <span>
                      {
                        workspace.label
                      }
                    </span>
                  ) : null}

                  {workspace ? (
                    <span aria-hidden="true">
                      /
                    </span>
                  ) : null}

                  <span className="text-slate-500">
                    {title}
                  </span>
                </div>

                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  {title}
                </h1>

                {subtitle ? (
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                    {
                      subtitle
                    }
                  </p>
                ) : null}
              </div>

              {workspace ? (
                <button
                  type="button"
                  onClick={
                    navigateHome
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Back to
                  workspace
                </button>
              ) : null}
            </div>

            {children}
          </div>
        </div>
      </main>

      <button
        type="button"
        onClick={() =>
          setCollapsed(
            (value) =>
              !value
          )
        }
        className="fixed bottom-5 left-4 z-[60] hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-lg lg:flex"
        aria-label={
          collapsed
            ? "Expand navigation"
            : "Collapse navigation"
        }
      >
        {collapsed
          ? "→"
          : "←"}
      </button>
    </div>
  );
}

export { ROLE_PRIORITY };
