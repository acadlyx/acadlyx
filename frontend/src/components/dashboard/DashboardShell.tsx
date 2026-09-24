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
  activeNavigationHref,
  canAccessRoute,
  navigationForUser,
  navigationGroups,
  primaryRole,
  ROLE_LABELS,
  workspaceHome,
} from "@/lib/navigation";

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
    useState<AuthUser | null>(null);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const allowedRolesKey =
    allowedRoles?.join(",") || "";

  useEffect(() => {
    let active = true;

    setLoadingUser(true);

    getCurrentUser()
      .then((currentUser) => {
        if (!active) {
          return;
        }

        if (
          !canAccessRoute(
            currentUser,
            pathname,
            allowedRoles,
          )
        ) {
          router.replace(
            workspaceHome(
              currentUser.roles,
            ),
          );

          return;
        }

        setUser(currentUser);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (
          error instanceof AuthRequiredError
        ) {
          router.replace("/login");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingUser(false);
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
    setMobileOpen(false);
  }, [pathname]);

  const navigation =
    useMemo(
      () =>
        user
          ? navigationForUser(user)
          : [],
      [user],
    );

  const groupedNavigation =
    useMemo(
      () =>
        navigationGroups(
          navigation,
        ),
      [navigation],
    );

  const activeHref =
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

  const role =
    primaryRole(
      user?.roles ||
        allowedRoles ||
        [],
    );

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  const displayName =
    user
      ? `${user.firstName} ${user.lastName}`.trim()
      : "";

  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
        <div className="flex h-full items-center px-3 sm:px-5">
          <button
            type="button"
            aria-label="Open workspace navigation"
            aria-expanded={
              mobileOpen
            }
            onClick={() =>
              setMobileOpen(
                (value) => !value,
              )
            }
            className="mr-3 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 lg:hidden"
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
            className="flex shrink-0 items-center gap-2.5"
          >
            <Image
              src="/branding/acadlyx-logo.png"
              alt="ACADLYX"
              width={34}
              height={34}
              className="h-8 w-8 object-contain"
              priority
            />

            <div className="hidden leading-none sm:block">
              <span className="block text-sm font-bold tracking-[0.12em] text-slate-950">
                ACADLYX
              </span>

              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.15em] text-slate-400">
                Education ERP
              </span>
            </div>
          </Link>

          <div className="ml-5 hidden min-w-0 border-l border-slate-200 pl-5 md:block">
            <p className="truncate text-sm font-semibold text-slate-900">
              {title}
            </p>

            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-800">
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

            <div className="rounded-xl border border-slate-200 bg-white">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={
                signOut
              }
              className="hidden rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close workspace navigation"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed bottom-0 left-0 top-16 z-40 w-[240px] border-r border-slate-200/90 bg-[#f8fafc]",
          "transition-transform duration-200",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {ROLE_LABELS[
                role
              ] ||
                role.replace(
                  /_/g,
                  " ",
                ) ||
                "ACADLYX"}
            </p>

            {loadingUser && (
              <div className="mt-2 h-2.5 w-24 animate-pulse rounded-full bg-slate-100" />
            )}
          </div>

          <nav
            aria-label="Workspace navigation"
            className="space-y-5 pb-8"
          >
            {loadingUser ? (
              <SidebarSkeleton />
            ) : groupedNavigation.length > 0 ? (
              groupedNavigation.map(
                (group) => (
                  <section
                    key={group.label}
                  >
                    <p className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {group.label}
                    </p>

                    <div className="mt-1.5 space-y-1">
                      {group.items.map(
                        (item) => {
                          const active =
                            item.href ===
                            activeHref;

                          return (
                            <Link
                              key={
                                item.href
                              }
                              href={
                                item.href
                              }
                              onClick={() =>
                                setMobileOpen(
                                  false,
                                )
                              }
                              className={[
                                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                                active
                                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                                  : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm",
                              ].join(
                                " ",
                              )}
                            >
                              <span
                                className={[
                                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs",
                                  active
                                    ? "bg-white/15 text-white"
                                    : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600",
                                ].join(
                                  " ",
                                )}
                              >
                                {
                                  item.icon
                                }
                              </span>

                              <span className="truncate">
                                {
                                  item.label
                                }
                              </span>
                            </Link>
                          );
                        },
                      )}
                    </div>
                  </section>
                ),
              )
            ) : (
              <SidebarSkeleton />
            )}
          </nav>
        </div>
      </aside>

      <main className="min-h-screen pt-16 lg:pl-[240px]">
        <div className="mx-auto min-h-[calc(100vh-64px)] w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map(
        (section) => (
          <div
            key={section}
          >
            <div className="mx-3 h-2 w-16 animate-pulse rounded-full bg-slate-200" />

            <div className="mt-3 space-y-1.5">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-200" />

                    <div className="h-3 flex-1 animate-pulse rounded-full bg-slate-100" />
                  </div>
                ),
              )}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
