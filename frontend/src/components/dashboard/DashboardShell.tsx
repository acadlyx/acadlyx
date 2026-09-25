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
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

import {
  activeNavigationHref,
  canAccessRoute,
  navigationForUser,
  navigationGroups,
  primaryRole,
  ROLE_LABELS,
  workspaceHome,
  type NavigationItem,
} from "@/lib/navigation";

const ICONS: Record<
  string,
  string
> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  shield:
    "M12 3.5 19 6v5.5c0 4.6-2.9 7.9-7 9.5-4.1-1.6-7-4.9-7-9.5V6l7-2.5ZM9 12l2 2 4-4",

  building:
    "M4 20h16M6 20V5.5L12 3l6 2.5V20M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1",

  academic:
    "M3 8.5 12 4l9 4.5-9 4.5-9-4.5ZM6 11.5v5.5c3.5 2.5 8.5 2.5 12 0v-5.5M21 9v6",

  audit:
    "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",

  admissions:
    "M6 4h12a2 2 0 0 1 2 2v12H4V6a2 2 0 0 1 2-2ZM8 9h8M8 13h8M8 17h5",

  intelligence:
    "M4 18V9M10 18V5M16 18v-7M22 18V3",

  registration:
    "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",

  movement:
    "M5 12h13M14 7l5 5-5 5",

  certificate:
    "M7 4h10v12H7zM10 20l2-2 2 2M9 8h6M9 11h6",

  finance:
    "M12 3v18M16 7.5c0-2-1.7-3.5-4-3.5s-4 1.5-4 3.5 1.7 3 4 3.5 4 1.5 4 3.5-1.7 3.5-4 3.5-4-1.5-4-3.5",

  exam:
    "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",

  results:
    "M5 19V9M12 19V5M19 19v-8",

  student:
    "M4 19c0-3 3-5 8-5s8 2 8 5M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",

  attendance:
    "M4 12h16M7 7h10M7 17h10",

  assignment:
    "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",

  marks:
    "M4 19V9M10 19V5M16 19v-8M22 19V3",

  leave:
    "M5 4h14v16H5zM8 8h8M8 12h5M8 16h6",

  receipt:
    "M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6M9 16h4",

  library:
    "M5 4h4v16H5zM15 4h4v16h-4zM9 6h6M9 18h6",

  website:
    "M4 5h16v14H4zM4 9h16M8 7h.01M11 7h.01M14 7h.01",

  profile:
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21c.5-4 3-6 7-6s6.5 2 7 6",

  lms:
    "M4 5h16v14H4zM8 9h8M8 13h5",

  application:
    "M6 3h12v18H6zM9 7h6M9 11h6M9 15h3",

  approval:
    "M5 12l4 4L19 6",
};

function Icon({
  name,
  active,
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
        <path
          d={
            ICONS[name] ||
            ICONS.home
          }
        />
      </svg>
    </span>
  );
}

function StableSidebar({
  navigation,
  active,
  role,
  mobileOpen,
  onClose,
  onSignOut,
}: {
  navigation: NavigationItem[];
  active: string | null;
  role: string;
  mobileOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const grouped =
    navigationGroups(
      navigation,
    );

  return (
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

          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="truncate text-[15px] font-extrabold">
              {ROLE_LABELS[
                role
              ] ||
                role.replace(
                  /_/g,
                  " ",
                ) ||
                "ACADLYX"}
            </p>

            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          </div>
        </div>

        <nav className="flex-1 space-y-6 pb-5">
          {grouped.map(
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
                    (entry) => {
                      const isActive =
                        entry.href ===
                        active;

                      return (
                        <Link
                          key={`${group.label}:${entry.href}`}
                          href={
                            entry.href
                          }
                          onClick={
                            onClose
                          }
                          className={`group flex min-h-[54px] items-center gap-3 rounded-[17px] px-2.5 pr-3 text-sm font-bold ${
                            isActive
                              ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]"
                              : "text-slate-600 hover:bg-white hover:text-slate-950"
                          }`}
                        >
                          <Icon
                            name={
                              entry.icon
                            }
                            active={
                              isActive
                            }
                          />

                          <span className="min-w-0 flex-1 truncate">
                            {
                              entry.label
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
          )}
        </nav>

        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={
              onSignOut
            }
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
  const pathname =
    usePathname();

  const router =
    useRouter();

  /*
   * IMPORTANT:
   *
   * The cached authenticated user is read synchronously.
   * This means the shell does not wait for /auth/me before rendering
   * its identity/navigation structure.
   */
  const cachedUser =
    getCachedCurrentUser();

  const [
    user,
    setUser,
  ] =
    useState<AuthUser | null>(
      cachedUser,
    );

  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false);

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(
      !cachedUser,
    );

  const allowedRolesKey =
    allowedRoles?.join(
      ",",
    ) || "";

  useEffect(() => {
    let alive = true;

    getCurrentUser({
      background:
        Boolean(user),
    })
      .then(
        (current) => {
          if (!alive) {
            return;
          }

          if (
            !canAccessRoute(
              current,
              pathname,
              allowedRolesKey
                ? allowedRolesKey.split(
                    ",",
                  )
                : undefined,
            )
          ) {
            router.replace(
              workspaceHome(
                current.roles,
              ),
            );

            return;
          }

          setUser(
            current,
          );
        },
      )
      .catch(
        (error) => {
          if (!alive) {
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
        },
      )
      .finally(
        () => {
          if (alive) {
            setAuthLoading(
              false,
            );
          }
        },
      );

    return () => {
      alive = false;
    };
  }, [
    pathname,
    router,
    allowedRolesKey,
  ]);

  useEffect(() => {
    setMobileOpen(
      false,
    );
  }, [
    pathname,
  ]);

  const role =
    primaryRole(
      user?.roles ||
        allowedRoles ||
        [],
    );

  const navigation =
    useMemo(
      () => {
        if (!user) {
          return [];
        }

        return navigationForUser(
          user,
        );
      },
      [user],
    );

  const active =
    useMemo(
      () =>
        activeNavigationHref(
          pathname,
          navigation,
        ),
      [
        pathname,
        navigation,
      ],
    );

  const displayName =
    user
      ? `${user.firstName} ${user.lastName}`.trim()
      : "Workspace";

  async function signOut() {
    await logout();
    router.replace(
      "/login",
    );
  }

  return (
    <div className="min-h-screen bg-[#edf3f8] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-[74px] border-b border-slate-200/90 bg-[#f8fafc]/95 backdrop-blur-xl">
        <div className="flex h-full items-center px-3 sm:px-5 lg:px-7">
          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) =>
                  !value,
              )
            }
            className="mr-3 grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label="Toggle navigation"
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
                {ROLE_LABELS[
                  role
                ] ||
                  role.replace(
                    /_/g,
                    " ",
                  )}
              </p>
            </div>

            <div className="rounded-[15px] border border-slate-200 bg-white">
              <AccountMenu />
            </div>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setMobileOpen(
              false,
            )
          }
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
        />
      ) : null}

      <StableSidebar
        navigation={
          navigation
        }
        active={
          active
        }
        role={role}
        mobileOpen={
          mobileOpen
        }
        onClose={() =>
          setMobileOpen(
            false,
          )
        }
        onSignOut={
          signOut
        }
      />

      <main className="min-h-screen pt-[74px] lg:pl-[282px]">
        <div className="mx-auto min-h-[calc(100vh-74px)] w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
          {authLoading &&
          !user ? (
            <div className="rounded-[24px] border border-slate-200 bg-white/70 p-6 text-sm font-semibold text-slate-500 shadow-sm">
              Loading workspace…
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
