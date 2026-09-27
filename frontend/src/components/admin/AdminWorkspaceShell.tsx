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
      ...(map.get(item.group) || []),
      item,
    ]);
  }

  return [...map.entries()];
}

function Skeleton() {
  return (
    <div
      className="space-y-5"
      aria-hidden="true"
    >
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-12 rounded-2xl bg-white/10 animate-pulse"
        />
      ))}
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

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(
      !getCachedCurrentUser(),
    );

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
        if (!alive) return;

        setUser(currentUser);
        setLoading(false);
      })
      .catch((error) => {
        if (!alive) return;

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

  useEffect(() => {
    if (!user) return;

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
    <div className="min-h-screen bg-[#07111f]">
      <header className="fixed inset-x-0 top-0 z-[70] h-[76px] border-b border-white/10 bg-[#081322]/90 text-white backdrop-blur-2xl">
        <div className="flex h-full items-center gap-3 px-3 sm:px-5 lg:px-7">
          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) =>
                  !value,
              )
            }
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 lg:hidden"
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

          <Link
            href="/admin"
            className="flex items-center gap-3"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
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
              <b className="block text-[13px] tracking-[0.16em]">
                ACADLYX
              </b>

              <small className="text-[9px] uppercase tracking-[0.18em] text-slate-400">
                Admin command center
              </small>
            </span>
          </Link>

          <div className="hidden border-l border-white/10 pl-5 md:block">
            <p className="text-sm font-black">
              {active?.label ||
                "Institution Admin"}
            </p>

            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              Institution administration
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-bold">
                {user
                  ? `${user.firstName} ${user.lastName}`.trim()
                  : "Workspace"}
              </p>

              <p className="text-[10px] text-slate-400">
                Institution Admin
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={signOut}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black"
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
          className="fixed inset-0 z-[55] bg-slate-950/70 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-[76px] z-[60] w-[292px] border-r border-white/10 bg-[#091525] text-white transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-5 rounded-[24px] border border-white/10 bg-gradient-to-br from-blue-600/25 to-cyan-400/10 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-200">
              Live workspace
            </p>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-black">
                Institution Admin
              </p>

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.8)]" />
            </div>
          </div>

          <nav className="flex-1 space-y-6">
            {loading && !user ? (
              <Skeleton />
            ) : (
              groups(
                navigation,
              ).map(
                ([group, items]) => (
                  <section
                    key={group}
                  >
                    <p className="px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                      {group}
                    </p>

                    <div className="mt-2 space-y-1">
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
                              className={`group flex min-h-[54px] items-center gap-3 rounded-[18px] px-3 text-sm font-black ${
                                isActive
                                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg"
                                  : "text-slate-400 hover:bg-white/[.06] hover:text-white"
                              }`}
                            >
                              <span
                                className={`grid h-10 w-10 place-items-center rounded-[14px] text-base ${
                                  isActive
                                    ? "bg-white/15"
                                    : "bg-white/[.05]"
                                }`}
                              >
                                {
                                  item.icon
                                }
                              </span>

                              <span className="min-w-0 flex-1 truncate">
                                {
                                  item.label
                                }
                              </span>

                              {isActive ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
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

          <p className="border-t border-white/10 px-3 pt-3 text-[10px] leading-5 text-slate-500">
            Sidebar visibility follows the authenticated permission set.
            Server-side authorization remains authoritative.
          </p>
        </div>
      </aside>

      <main className="min-h-screen bg-[radial-gradient(circle_at_70%_0%,rgba(37,99,235,.13),transparent_30rem),linear-gradient(135deg,#f7faff,#eef4fa,#f8fbff)] pt-[76px] lg:pl-[292px]">
        <div className="min-h-[calc(100vh-76px)] px-3 py-4 sm:px-5 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
