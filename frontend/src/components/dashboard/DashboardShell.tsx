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

import {
  getInstitutionAdminNavigation,
  institutionAdminRouteAllowed,
} from "@/lib/institutionAdminNavigation";

const ICON_PATHS: Record<string, string> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5ZM8 12h3M13 12h3M8 15.5h3",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  date:
    "M6 3.5v3M18 3.5v3M4 8.5h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2.4 1 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  shield:
    "M12 3.5 19 6v5.5c0 4.6-2.9 7.9-7 9.5-4.1-1.6-7-4.9-7-9.5V6l7-2.5ZM9 12l2 2 4-4",

  admissions:
    "M5 19.5h14M7 16.5h10M8 13.5h8M9.5 10.5h5M12 4v4.5",

  reports:
    "M5 19.5V5h14v14.5M8.5 16v-3M12 16V9M15.5 16v-5",

  intelligence:
    "M12 3.5 14 9l5.5 1.5L14 12l-2 6-2-6-5.5-1.5L10 9l2-5.5ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16",

  registration:
    "M6 4.5h12v15H6zM9 8h6M9 12h6M9 16h4",

  movement:
    "M12 4v16M7 9l5-5 5 5M7 15l5 5 5-5",

  certificate:
    "M7 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8.5 8h7M8.5 12h7M8.5 16h4",
};

function ShellIcon({
  name,
  active = false,
}: {
  name: string;
  active?: boolean;
}) {
  return (
    <span
      className={[
        "grid h-10 w-10 shrink-0 place-items-center rounded-[13px] transition-colors",
        active
          ? "bg-white/16 text-white"
          : "bg-[#edf2f6] text-[#91a1b6] group-hover:bg-blue-50 group-hover:text-blue-600",
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
        <path
          d={
            ICON_PATHS[name] ||
            ICON_PATHS.home
          }
        />
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

type ShellItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
};

export function DashboardShell({
  title,
  subtitle,
  children,
  allowedRoles,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  allowedRoles?: string[];
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    null,
  );

  const [
    loadingUser,
    setLoadingUser,
  ] = useState(true);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

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

        const isInstitutionAdmin =
          currentUser.roles.includes(
            "INSTITUTION_ADMIN",
          );

        const allowed =
          isInstitutionAdmin
            ? institutionAdminRouteAllowed(
                currentUser,
                pathname,
              )
            : canAccessRoute(
                currentUser,
                pathname,
                allowedRoles,
              );

        if (!allowed) {
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
    allowedRoles,
  ]);

  useEffect(() => {
    setMobileOpen(false);
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
    useMemo<ShellItem[]>(() => {
      if (
        isInstitutionAdmin
      ) {
        return getInstitutionAdminNavigation(
          user,
        ).map(
          (item) => ({
            label:
              item.label,
            href:
              item.href,
            icon:
              item.icon,
            group:
              item.group,
          }),
        );
      }

      if (!user) {
        return [
          {
            label:
              ROLE_LABELS[
                role
              ] ||
              "Workspace",
            href:
              workspaceHome(
                allowedRoles ||
                  [],
              ),
            icon:
              "home",
            group:
              "Workspace",
          },
          {
            label:
              "Account security",
            href:
              "/account-security",
            icon:
              "shield",
            group:
              "Account",
          },
        ];
      }

      return navigationForUser(
        user,
      ).map(
        (item) => ({
          label:
            item.label,
          href:
            item.href,
          icon:
            item.icon,
          group:
            item.group ||
            "Workspace",
        }),
      );
    }, [
      isInstitutionAdmin,
      user,
      role,
      allowedRolesKey,
      allowedRoles,
    ]);

  const groupedNavigation =
    useMemo(() => {
      const groups =
        new Map<
          string,
          ShellItem[]
        >();

      for (
        const item of navigation
      ) {
        groups.set(
          item.group,
          [
            ...(groups.get(
              item.group,
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
            (a, b) =>
              b.href.length -
              a.href.length,
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
    <div className="min-h-screen bg-[#eef3f7] text-[#172033]">
      <header className="fixed inset-x-0 top-0 z-50 h-[74px] border-b border-[#dfe7ee] bg-[#f8fafc]/96 backdrop-blur-xl">
        <div className="flex h-full items-center px-3 sm:px-5 lg:px-6">
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
            className="mr-3 grid h-10 w-10 place-items-center rounded-[14px] border border-[#d9e2ea] bg-white text-[#4c5d73] shadow-sm lg:hidden"
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
            className="flex min-w-0 items-center gap-3"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[#101828] shadow-sm">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={29}
                height={29}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>

            <span className="hidden leading-none sm:block">
              <span className="block text-[13px] font-black tracking-[0.12em] text-[#101828]">
                ACADLYX
              </span>

              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8b9aab]">
                Education ERP
              </span>
            </span>
          </Link>

          <div className="ml-5 hidden min-w-0 border-l border-[#dfe7ee] pl-5 md:block">
            <p className="truncate text-sm font-extrabold text-[#172033]">
              {title}
            </p>

            {subtitle ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-[#77879b]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-extrabold text-[#243149]">
                {displayName}
              </p>

              <p className="mt-0.5 text-[10px] font-semibold text-[#8796a9]">
                {ROLE_LABELS[
                  role
                ] ||
                  role.replace(
                    /_/g,
                    " ",
                  )}
              </p>
            </div>

            <div className="rounded-[15px] border border-[#dce4eb] bg-white shadow-sm">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={
                signOut
              }
              className="hidden rounded-[14px] border border-[#dce4eb] bg-white px-4 py-2.5 text-xs font-extrabold text-[#40516a] shadow-sm transition hover:bg-[#f5f8fb] sm:block"
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
          className="fixed inset-0 z-30 bg-[#172033]/20 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed bottom-0 left-0 top-[74px] z-40 w-[282px] border-r border-[#dfe7ee] bg-[#f7f9fb]",
          "shadow-[12px_0_35px_rgba(20,32,50,0.035)]",
          "transition-transform duration-200 lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-5 rounded-[22px] border border-[#dfe7ee] bg-white px-4 py-4 shadow-[0_6px_20px_rgba(20,32,50,0.035)]">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#92a1b4]">
              Workspace
            </p>

            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-[17px] font-black tracking-[-0.02em] text-[#243149]">
                {ROLE_LABELS[
                  role
                ] ||
                  role.replace(
                    /_/g,
                    " ",
                  ) ||
                  "ACADLYX"}
              </p>

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.09)]" />
            </div>
          </div>

          <nav
            aria-label="Workspace navigation"
            className="space-y-6 pb-8"
          >
            {loadingUser &&
            !navigation.length ? (
              <div className="space-y-2 px-1">
                {[
                  1,
                  2,
                  3,
                  4,
                  5,
                ].map(
                  (item) => (
                    <div
                      key={
                        item
                      }
                      className="h-[54px] animate-pulse rounded-[17px] bg-[#edf2f6]"
                    />
                  ),
                )}
              </div>
            ) : null}

            {groupedNavigation.map(
              (group) => (
                <section
                  key={
                    group.label
                  }
                >
                  <p className="px-3 text-[9px] font-black uppercase tracking-[0.23em] text-[#91a1b6]">
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
                              "group flex min-h-[54px] items-center gap-3 rounded-[17px] px-2.5 pr-3 text-[14px] font-extrabold transition-all",
                              active
                                ? "bg-[#2864e8] text-white shadow-[0_8px_20px_rgba(40,100,232,0.22)]"
                                : "text-[#4d5d74] hover:bg-white hover:text-[#172033] hover:shadow-[0_4px_14px_rgba(20,32,50,0.045)]",
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
