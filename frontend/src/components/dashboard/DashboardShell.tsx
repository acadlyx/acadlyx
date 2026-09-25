"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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

type NavItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
  permissions?: string[];
};

const ADMIN_NAV: NavItem[] = [
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
    label: "Students",
    href: "/students",
    icon: "people",
    group: "Administration",
    permissions: ["students.read"],
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

const ICONS: Record<string, string> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

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

function Icon({
  name,
  active = false,
}: {
  name: string;
  active?: boolean;
}) {
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${
        active
          ? "bg-white/15 text-white"
          : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
      >
        <path d={ICONS[name] || ICONS.home} />
      </svg>
    </span>
  );
}

const matches = (
  path: string,
  route: string,
) =>
  path === route ||
  path.startsWith(`${route}/`);

const permitted = (
  user: AuthUser,
  permissions?: string[],
) =>
  !permissions?.length ||
  permissions.every((permission) =>
    user.permissions.includes(permission),
  );

function groups(items: NavItem[]) {
  const map = new Map<
    string,
    NavItem[]
  >();

  items.forEach((item) =>
    map.set(item.group, [
      ...(map.get(item.group) || []),
      item,
    ]),
  );

  return [...map.entries()].map(
    ([label, groupItems]) => ({
      label,
      items: groupItems,
    }),
  );
}

function LoadingSidebar() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((group) => (
        <div key={group}>
          <div className="mx-3 h-2 w-16 animate-pulse rounded bg-slate-200" />

          <div className="mt-3 space-y-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="flex h-14 items-center gap-3 px-3"
              >
                <div className="h-10 w-10 animate-pulse rounded-[14px] bg-slate-200" />
                <div className="h-3 flex-1 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const allowedRolesKey =
    allowedRoles?.join(",") || "";

  useEffect(() => {
    let alive = true;

    getCurrentUser()
      .then((current) => {
        if (!alive) return;

        const adminRoute =
          current.roles.includes(
            "INSTITUTION_ADMIN",
          ) &&
          ADMIN_NAV.some((item) =>
            matches(
              pathname,
              item.href,
            ),
          );

        if (
          !canAccessRoute(
            current,
            pathname,
            allowedRolesKey
              ? allowedRolesKey.split(",")
              : undefined,
          ) &&
          !adminRoute
        ) {
          router.replace(
            workspaceHome(
              current.roles,
            ),
          );

          return;
        }

        setUser(current);
      })
      .catch((error) => {
        if (
          alive &&
          error instanceof
            AuthRequiredError
        ) {
          router.replace(
            "/login",
          );
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [
    pathname,
    router,
    allowedRolesKey,
  ]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const role = primaryRole(
    user?.roles ||
      allowedRoles ||
      [],
  );

  const navigation =
    useMemo<NavItem[]>(() => {
      if (
        role ===
        "INSTITUTION_ADMIN"
      ) {
        return ADMIN_NAV.filter(
          (item) =>
            !user ||
            permitted(
              user,
              item.permissions,
            ),
        );
      }

      if (user) {
        return navigationForUser(
          user,
        ).map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          group:
            item.group ||
            "Workspace",
          permissions:
            item.permissions,
        }));
      }

      return [
        {
          label:
            ROLE_LABELS[role] ||
            "Overview",
          href: workspaceHome(
            allowedRoles || [],
          ),
          icon: "home",
          group: "Workspace",
        },
        {
          label:
            "Account security",
          href:
            "/account-security",
          icon: "shield",
          group: "Account",
        },
      ];
    }, [
      role,
      user,
      allowedRoles,
    ]);

  const grouped =
    useMemo(
      () => groups(navigation),
      [navigation],
    );

  const active =
    useMemo(
      () =>
        navigation
          .filter((item) =>
            matches(
              pathname,
              item.href,
            ),
          )
          .sort(
            (a, b) =>
              b.href.length -
              a.href.length,
          )[0]?.href || null,
      [navigation, pathname],
    );

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Workspace";

  return (
    <div className="min-h-screen bg-[#edf3f8] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-[74px] border-b border-slate-200/90 bg-[#f8fafc]/95 backdrop-blur-xl">
        <div className="flex h-full items-center px-3 sm:px-5 lg:px-7">
          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) => !value,
              )
            }
            className="mr-3 grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200 bg-white text-slate-700 lg:hidden"
          >
            {mobileOpen ? "×" : "☰"}
          </button>

          <Link
            href={workspaceHome(
              user?.roles ||
                allowedRoles ||
                [],
            )}
            className="flex items-center gap-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-slate-950">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>

            <span className="hidden sm:block">
              <b className="block text-[13px] tracking-[0.12em] text-slate-950">
                ACADLYX
              </b>

              <small className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Education ERP
              </small>
            </span>
          </Link>

          <div className="ml-5 hidden min-w-0 border-l border-slate-200 pl-5 md:block">
            <p className="truncate text-sm font-bold">
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
              <p className="text-xs font-bold">
                {displayName}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-500">
                {ROLE_LABELS[role] ||
                  role.replace(
                    /_/g,
                    " ",
                  )}
              </p>
            </div>

            <div className="rounded-[15px] border border-slate-200 bg-white">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={signOut}
              className="rounded-[15px] border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-[74px] z-40 w-[282px] border-r border-slate-200/90 bg-[#f7f9fb] shadow-[12px_0_35px_rgba(15,23,42,0.035)] transition-transform lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Workspace
            </p>

            <div className="mt-1 flex items-center justify-between">
              <p className="truncate text-[15px] font-extrabold">
                {ROLE_LABELS[role] ||
                  role.replace(
                    /_/g,
                    " ",
                  ) ||
                  "ACADLYX"}
              </p>

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
          </div>

          <nav className="flex-1 space-y-6 pb-5">
            {loading && !user ? (
              <LoadingSidebar />
            ) : (
              grouped.map(
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
                          const isActive =
                            item.href ===
                            active;

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
                              className={`group flex min-h-[54px] items-center gap-3 rounded-[17px] px-2.5 pr-3 text-sm font-bold ${
                                isActive
                                  ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]"
                                  : "text-slate-600 hover:bg-white hover:text-slate-950"
                              }`}
                            >
                              <Icon
                                name={
                                  item.icon
                                }
                                active={
                                  isActive
                                }
                              />

                              <span className="min-w-0 flex-1 truncate">
                                {
                                  item.label
                                }
                              </span>

                              {isActive ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                              ) : null}
                            </Link>
                          );
                        },
                      )}
                    </div>
                  </section>
                ),
              )
            )}
          </nav>

          <div className="border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-[16px] px-2.5 text-left text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-700"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-red-50 text-red-500">
                ↪
              </span>

              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen pt-[74px] lg:pl-[282px]">
        <div className="mx-auto min-h-[calc(100vh-74px)] w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
