"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import { AccountMenu } from "@/components/auth/AccountMenu";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";
import {
  canAccessRoute,
  navigationForUser,
  primaryRole,
  ROLE_LABELS,
  workspaceHome,
} from "@/lib/navigation";

type ShellNavigationItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
  permissions?: string[];
};

/**
 * Institution Admin is an institution-operations role, not a collection of
 * every read-only specialist workspace.
 *
 * The backend remains the security boundary.
 * This list controls the workspace experience and prevents the sidebar from
 * advertising specialist ownership that the role does not have.
 *
 * Do not add /enrollment or /institution-settings here:
 * both currently redirect to another surface instead of being independent
 * workflows.
 */
const INSTITUTION_ADMIN_NAVIGATION: ShellNavigationItem[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: "home",
    group: "Workspace",
  },
  {
    label: "People",
    href: "/user-management",
    icon: "people",
    group: "Administration",
    permissions: ["users.read"],
  },
  {
    label: "Timetable",
    href: "/timetable",
    icon: "calendar",
    group: "Institution",
    permissions: ["timetable.read"],
  },
  {
    label: "Notices",
    href: "/notices",
    icon: "notice",
    group: "Institution",
    permissions: ["notices.read"],
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: "date",
    group: "Institution",
    permissions: ["calendar.read"],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: "bell",
    group: "Institution",
    permissions: ["notifications.read"],
  },
  {
    label: "Operations",
    href: "/operations",
    icon: "settings",
    group: "Institution",
    permissions: ["operations.read"],
  },
  {
    label: "Documents",
    href: "/forms",
    icon: "document",
    group: "Administration",
    permissions: ["documents.read"],
  },
  {
    label: "Account security",
    href: "/account-security",
    icon: "shield",
    group: "Account",
  },
];

const ICON_PATHS: Record<string, string> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6 3.5h12A2 2 0 0 1 20 5.5v13A2 2 0 0 1 18 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8 12h3M13 12h3M8 15.5h3",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  date:
    "M6 3.5v3M18 3.5v3M4 8.5h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  document:
    "M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM14 3.5v5h4M8.5 12h7M8.5 15.5h7",

  shield:
    "M12 3.5 19 6v5.5c0 4.6-2.9 7.9-7 9.5-4.1-1.6-7-4.9-7-9.5V6l7-2.5ZM9 12l2 2 4-4",
};

function ShellIcon({
  name,
  active = false,
}: {
  name: string;
  active?: boolean;
}) {
  const path =
    ICON_PATHS[name] ||
    ICON_PATHS.home;

  return (
    <span
      className={[
        "grid h-10 w-10 shrink-0 place-items-center rounded-[14px] transition",
        active
          ? "bg-white/16 text-white"
          : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    </span>
  );
}

function matchesRoute(
  pathname: string,
  route: string,
) {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function hasPermissions(
  user: AuthUser,
  permissions?: string[],
) {
  if (!permissions?.length) {
    return true;
  }

  const granted = new Set(
    user.permissions || [],
  );

  return permissions.every(
    (permission) =>
      granted.has(permission),
  );
}

function getInstitutionAdminNavigation(
  user: AuthUser | null,
): ShellNavigationItem[] {
  if (!user) {
    return INSTITUTION_ADMIN_NAVIGATION;
  }

  return INSTITUTION_ADMIN_NAVIGATION.filter(
    (item) =>
      hasPermissions(
        user,
        item.permissions,
      ),
  );
}

function getFallbackNavigation(
  user: AuthUser | null,
  allowedRoles?: string[],
): ShellNavigationItem[] {
  if (user) {
    return navigationForUser(user).map(
      (item) => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
        group:
          item.group ||
          "Workspace",
        permissions:
          item.permissions,
      }),
    );
  }

  const role =
    primaryRole(
      allowedRoles || [],
    );

  const home =
    workspaceHome(
      allowedRoles || [],
    );

  return [
    {
      label:
        ROLE_LABELS[role] ||
        "Overview",
      href: home,
      icon: "home",
      group: "Workspace",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "shield",
      group: "Account",
    },
  ];
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
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [user, setUser] =
    useState<AuthUser | null>(
      null,
    );

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const allowedRolesKey =
    allowedRoles?.join(",") ||
    "";

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!active) {
          return;
        }

        const institutionAdminStaticRoute =
          currentUser.roles.includes(
            "INSTITUTION_ADMIN",
          ) &&
          INSTITUTION_ADMIN_NAVIGATION.some(
            (item) =>
              matchesRoute(
                pathname,
                item.href,
              ),
          );

        if (
          !canAccessRoute(
            currentUser,
            pathname,
            allowedRoles,
          ) &&
          !institutionAdminStaticRoute
        ) {
          router.replace(
            workspaceHome(
              currentUser.roles,
            ),
          );

          return;
        }

        setUser(
          currentUser,
        );
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (
          error instanceof
          AuthRequiredError
        ) {
          router.replace(
            "/login",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingUser(
            false,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    router,
    pathname,
    allowedRolesKey,
  ]);

  useEffect(() => {
    setMobileOpen(
      false,
    );
  }, [pathname]);

  const role =
    primaryRole(
      user?.roles ||
        allowedRoles ||
        [],
    );

  const isInstitutionAdmin =
    role ===
    "INSTITUTION_ADMIN";

  const navigation =
    useMemo(() => {
      if (
        isInstitutionAdmin
      ) {
        return getInstitutionAdminNavigation(
          user,
        );
      }

      return getFallbackNavigation(
        user,
        allowedRoles,
      );
    }, [
      isInstitutionAdmin,
      user,
      allowedRolesKey,
    ]);

  const groupedNavigation =
    useMemo(() => {
      const groups =
        new Map<
          string,
          ShellNavigationItem[]
        >();

      for (
        const item of navigation
      ) {
        const group =
          item.group ||
          "Workspace";

        groups.set(
          group,
          [
            ...(groups.get(
              group,
            ) || []),
            item,
          ],
        );
      }

      return [
        ...groups.entries(),
      ].map(
        ([
          label,
          items,
        ]) => ({
          label,
          items,
        }),
      );
    }, [
      navigation,
    ]);

  const activeHref =
    useMemo(
      () =>
        navigation
          .filter(
            (item) =>
              matchesRoute(
                pathname,
                item.href,
              ),
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.href.length -
              left.href.length,
          )[0]?.href ||
        null,
      [
        pathname,
        navigation,
      ],
    );

  async function signOut() {
    await logout();

    router.replace(
      "/login",
    );
  }

  const displayName =
    user
      ? `${user.firstName} ${user.lastName}`.trim()
      : "Workspace";

  return (
    <div className="min-h-screen bg-[#edf2f6] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-slate-200/90 bg-[#f8fafc]/95 backdrop-blur-xl">
        <div className="flex h-full items-center px-3 sm:px-5 lg:px-7">
          <button
            type="button"
            aria-label="Open workspace navigation"
            aria-expanded={
              mobileOpen
            }
            onClick={() =>
              setMobileOpen(
                (value) =>
                  !value,
              )
            }
            className="mr-3 grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
          >
            {mobileOpen
              ? "×"
              : "☰"}
          </button>

          <Link
            href={workspaceHome(
              user?.roles ||
                allowedRoles ||
                [],
            )}
            className="flex shrink-0 items-center gap-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-slate-950 shadow-sm">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>

            <span className="hidden leading-none sm:block">
              <span className="block text-[13px] font-black tracking-[0.12em] text-slate-950">
                ACADLYX
              </span>

              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Education ERP
              </span>
            </span>
          </Link>

          <div className="ml-5 hidden min-w-0 border-l border-slate-200 pl-5 md:block">
            <p className="truncate text-sm font-bold text-slate-900">
              {title}
            </p>

            {subtitle ? (
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-bold text-slate-800">
                {displayName}
              </p>

              <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                {ROLE_LABELS[role] ||
                  role.replace(
                    /_/g,
                    " ",
                  )}
              </p>
            </div>

            <div className="rounded-[15px] border border-slate-200 bg-white shadow-sm">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={
                signOut
              }
              className="hidden rounded-[15px] border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:block"
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
          onClick={() =>
            setMobileOpen(
              false,
            )
          }
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed bottom-0 left-0 top-[72px] z-40 w-[276px] border-r border-slate-200/90 bg-[#f6f8fa]",
          "shadow-[10px_0_35px_rgba(15,23,42,0.03)]",
          "transition-transform duration-200 lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Workspace
                </p>

                <p className="mt-1 text-[15px] font-extrabold text-slate-900">
                  {ROLE_LABELS[role] ||
                    role.replace(
                      /_/g,
                      " ",
                    ) ||
                    "ACADLYX"}
                </p>
              </div>

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.10)]" />
            </div>
          </div>

          <nav
            aria-label="Workspace navigation"
            className="space-y-6 pb-8"
          >
            {groupedNavigation.map(
              (group) => (
                <section
                  key={
                    group.label
                  }
                >
                  <p className="px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {group.label}
                  </p>

                  <div className="mt-2 space-y-1">
                    {group.items.map(
                      (item) => {
                        const active =
                          item.href ===
                          activeHref;

                        return (
                          <Link
                            key={`${group.label}:${item.href}`}
                            href={
                              item.href
                            }
                            onClick={() =>
                              setMobileOpen(
                                false,
                              )
                            }
                            className={[
                              "group flex min-h-[54px] items-center gap-3 rounded-[17px] px-2.5 pr-3 text-sm font-bold transition-all",
                              active
                                ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]"
                                : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm",
                            ].join(
                              " ",
                            )}
                          >
                            <ShellIcon
                              name={
                                item.icon
                              }
                              active={
                                active
                              }
                            />

                            <span className="min-w-0 flex-1 truncate">
                              {
                                item.label
                              }
                            </span>

                            {active ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                            ) : null}
                          </Link>
                        );
                      },
                    )}
                  </div>
                </section>
              ),
            )}
          </nav>

          {loadingUser ? (
            <div className="mt-auto rounded-[18px] border border-slate-200 bg-white p-3 text-[10px] font-semibold text-slate-400 shadow-sm">
              Securing workspace…
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-h-screen pt-[72px] lg:pl-[276px]">
        <div className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
