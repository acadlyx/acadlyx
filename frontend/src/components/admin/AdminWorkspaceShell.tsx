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
  canAccessAdminPath,
  getAdminNavigation,
  findAdminNavItem,
  AdminNavItem,
} from "@/lib/adminNavigation";

const SIDEBAR_STORAGE_KEY =
  "acadlyx-dashboard-sidebar-collapsed";

function groups(
  items: AdminNavItem[],
) {
  const map =
    new Map<
      string,
      AdminNavItem[]
    >();

  for (const item of items) {
    map.set(item.group, [
      ...(map.get(item.group) ||
        []),
      item,
    ]);
  }

  return [
    ...map.entries(),
  ];
}

function AdminIcon({
  item,
  active,
}: {
  item: AdminNavItem;
  active: boolean;
}) {
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] text-sm font-black transition ${
        active
          ? "bg-white/15 text-white"
          : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
      }`}
    >
      {item.icon}
    </span>
  );
}

function Skeleton({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <div
      className="space-y-5"
      aria-hidden="true"
    >
      {[1, 2, 3].map(
        (group) => (
          <div key={group}>
            {!collapsed ? (
              <div className="mx-3 h-2 w-16 rounded bg-slate-200" />
            ) : null}

            <div className="mt-3 space-y-2">
              {[1, 2].map(
                (item) => (
                  <div
                    key={item}
                    className={`flex h-12 items-center gap-3 ${
                      collapsed
                        ? "justify-center"
                        : "px-3"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-[13px] bg-slate-200" />

                    {!collapsed ? (
                      <div className="h-3 flex-1 rounded bg-slate-200" />
                    ) : null}
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

export function AdminWorkspaceShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [user, setUser] =
    useState<AuthUser | null>(
      () =>
        getCachedCurrentUser(),
    );

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const [loading, setLoading] =
    useState(
      !getCachedCurrentUser(),
    );

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          SIDEBAR_STORAGE_KEY,
        );

      if (stored === "true") {
        setCollapsed(true);
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  function toggleSidebar() {
    setCollapsed(
      (current) => {
        const next = !current;

        try {
          window.localStorage.setItem(
            SIDEBAR_STORAGE_KEY,
            String(next),
          );
        } catch {
          // Ignore storage failures.
        }

        return next;
      },
    );
  }

  useEffect(() => {
    let alive = true;

    const cached =
      getCachedCurrentUser();

    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    getCurrentUser({
      background:
        Boolean(cached),
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
          router.replace(
            "/login",
          );

          return;
        }

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  /*
   * IMPORTANT:
   *
   * This remains the authorization gate.
   * Hiding an item in the UI never grants access.
   * The backend remains authoritative.
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
      router.replace(
        "/admin",
      );
    }
  }, [
    user,
    pathname,
    router,
  ]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navigation =
    useMemo(
      () =>
        getAdminNavigation(
          user,
        ),
      [user],
    );

  const active =
    findAdminNavItem(
      pathname,
    );

  async function signOut() {
    await logout();

    router.replace(
      "/login",
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-900">
      {/* Unified header */}
      <header className="fixed inset-x-0 top-0 z-[70] h-[74px] border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-3 sm:px-5 lg:px-7">
          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) =>
                  !value,
              )
            }
            className="grid h-10 w-10 place-items-center rounded-[13px] border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
            aria-label={
              mobileOpen
                ? "Close navigation"
                : "Open navigation"
            }
          >
            {mobileOpen
              ? "×"
              : "☰"}
          </button>

          {/* Brand */}
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-3"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-slate-950">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </span>

            <span className="hidden min-w-0 sm:block">
              <b className="block truncate text-[13px] tracking-[0.12em] text-slate-950">
                ACADLYX
              </b>

              <small className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Education ERP
              </small>
            </span>
          </Link>

          {/* Current module */}
          <div className="ml-2 hidden min-w-0 border-l border-slate-200 pl-4 md:block lg:ml-3 lg:pl-5">
            <p className="truncate text-sm font-extrabold text-slate-900">
              {active?.label ||
                "Admin Command Center"}
            </p>

            <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Institution administration
            </p>
          </div>

          {/* Desktop toggle */}
          <button
            type="button"
            onClick={
              toggleSidebar
            }
            className="ml-2 hidden h-10 w-10 place-items-center rounded-[13px] border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-200 hover:text-blue-600 lg:grid"
            aria-label={
              collapsed
                ? "Show sidebar"
                : "Hide sidebar"
            }
            title={
              collapsed
                ? "Show sidebar"
                : "Hide sidebar"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />

              <path
                d={
                  collapsed
                    ? "M9 8l4 4-4 4"
                    : "M15 8l-4 4 4 4"
                }
              />
            </svg>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-extrabold text-slate-900">
                {user
                  ? `${user.firstName} ${user.lastName}`.trim()
                  : "Workspace"}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-500">
                Institution Admin
              </p>
            </div>

            <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-[14px] border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-[55] bg-slate-950/20 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      {/* Unified admin sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-[74px] z-[60] border-r border-slate-200 bg-[#f7f9fb] shadow-[8px_0_28px_rgba(15,23,42,0.035)] transition-[width,transform] duration-200 ${
          collapsed
            ? "w-[88px]"
            : "w-[282px]"
        } ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          {/* Workspace card */}
          <div
            className={`mb-4 rounded-[20px] border border-slate-200 bg-white shadow-sm ${
              collapsed
                ? "p-2"
                : "px-4 py-4"
            }`}
          >
            {collapsed ? (
              <div
                className="grid place-items-center"
                title="Institution Admin"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-blue-600 text-xs font-black text-white">
                  A
                </span>
              </div>
            ) : (
              <>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Workspace
                </p>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-[15px] font-extrabold text-slate-900">
                    Institution Admin
                  </p>

                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                </div>
              </>
            )}
          </div>

          <nav
            className="flex-1 space-y-6 pb-5"
            aria-label="Admin navigation"
          >
            {loading &&
            !user ? (
              <Skeleton
                collapsed={
                  collapsed
                }
              />
            ) : (
              groups(
                navigation,
              ).map(
                ([group, items]) => (
                  <section
                    key={group}
                  >
                    {!collapsed ? (
                      <p className="px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                        {group}
                      </p>
                    ) : null}

                    <div
                      className={`mt-2 space-y-1 ${
                        collapsed
                          ? "space-y-2"
                          : ""
                      }`}
                    >
                      {items.map(
                        (item) => {
                          const isActive =
                            item.href ===
                              pathname ||
                            pathname.startsWith(
                              `${item.href}/`,
                            );

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
                              title={
                                collapsed
                                  ? item.label
                                  : undefined
                              }
                              className={`group flex min-h-[52px] items-center rounded-[16px] text-sm font-bold transition ${
                                collapsed
                                  ? "justify-center px-2"
                                  : "gap-3 px-2.5 pr-3"
                              } ${
                                isActive
                                  ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)]"
                                  : "text-slate-600 hover:bg-white hover:text-slate-950"
                              }`}
                            >
                              <AdminIcon
                                item={
                                  item
                                }
                                active={
                                  isActive
                                }
                              />

                              {!collapsed ? (
                                <>
                                  <span className="min-w-0 flex-1 truncate">
                                    {
                                      item.label
                                    }
                                  </span>

                                  {isActive ? (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" />
                                  ) : null}
                                </>
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

          {/* Sidebar controls */}
          <div className="border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={
                toggleSidebar
              }
              className={`flex min-h-[50px] w-full items-center rounded-[16px] text-left text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 ${
                collapsed
                  ? "justify-center"
                  : "gap-3 px-2.5"
              }`}
              title={
                collapsed
                  ? "Show sidebar"
                  : "Hide sidebar"
              }
            >
              <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-blue-50 text-blue-600">
                {collapsed
                  ? "→"
                  : "←"}
              </span>

              {!collapsed ? (
                <span>
                  Hide sidebar
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={
                signOut
              }
              className={`mt-1 flex min-h-[50px] w-full items-center rounded-[16px] text-left text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-700 ${
                collapsed
                  ? "justify-center"
                  : "gap-3 px-2.5"
              }`}
              title="Sign out"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-red-50 text-red-500">
                ↪
              </span>

              {!collapsed ? (
                <span>
                  Sign out
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </aside>

      {/* Unified page surface */}
      <main
        className={`min-h-screen pt-[74px] transition-[padding] duration-200 ${
          collapsed
            ? "lg:pl-[88px]"
            : "lg:pl-[282px]"
        }`}
      >
        <div className="min-h-[calc(100vh-74px)] bg-[radial-gradient(circle_at_70%_0%,rgba(37,99,235,.08),transparent_30rem),linear-gradient(135deg,#f7faff,#eef4fa,#f8fbff)] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
