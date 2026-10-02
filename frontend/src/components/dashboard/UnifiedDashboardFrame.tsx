"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";

export type UnifiedNavItem = {
  label: string;
  href: string;
  icon?: string;
  group?: string;
};

const SIDEBAR_STORAGE_KEY =
  "acadlyx-dashboard-sidebar-collapsed";

const ICONS: Record<string, string> = {
  home: "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 0 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  date:
    "M6 3.5v3M18 3.5v3M4 8.5h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2.4-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  document:
    "M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM14 3.5v5h4M8.5 12h7M8.5 15.5h7",

  shield:
    "M12 3.5 19 6v5.5c0 4.6-2.9 7.9-7 9.5-4.1-1.6-7-4.9-7-9.5V6l7-2.5ZM9 12l2 2 4-4",

  academic:
    "M3.5 9.5 12 4l8.5 5.5L12 15 3.5 9.5ZM7 12.2v4.3c2.9 2 7.1 2 10 0v-4.3M20.5 10v5.5",

  grid:
    "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",

  chart:
    "M5 20V10M12 20V4M19 20v-7",

  book:
    "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM4 5.5v15.5",

  users:
    "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3.5 3.5 0 0 0 0-7M21 21v-2a4 4 0 0 0-3-3.87",

  folder:
    "M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z",
};

function groupNavigation(items: UnifiedNavItem[]) {
  const groups = new Map<string, UnifiedNavItem[]>();

  for (const item of items) {
    const group = item.group || "Workspace";
    const current = groups.get(group) || [];

    current.push(item);
    groups.set(group, current);
  }

  return [...groups.entries()];
}

function NavIcon({
  item,
  active,
}: {
  item: UnifiedNavItem;
  active: boolean;
}) {
  const path = item.icon
    ? ICONS[item.icon]
    : undefined;

  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${
        active
          ? "bg-white/15 text-white"
          : "bg-white/10 text-slate-300 group-hover:bg-blue-500/15 group-hover:text-blue-300"
      }`}
      aria-hidden="true"
    >
      {path ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          <path d={path} />
        </svg>
      ) : (
        <span className="text-[15px] leading-none">
          {item.icon || "•"}
        </span>
      )}
    </span>
  );
}

function SkeletonSidebar({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <div
      className="space-y-5"
      aria-hidden="true"
    >
      {[1, 2, 3].map((group) => (
        <div key={group}>
          {!collapsed ? (
            <div className="mx-3 h-2 w-16 rounded bg-slate-800" />
          ) : null}

          <div className="mt-3 space-y-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className={`flex h-12 items-center gap-3 ${
                  collapsed
                    ? "justify-center"
                    : "px-3"
                }`}
              >
                <div className="h-10 w-10 rounded-[13px] bg-slate-800" />

                {!collapsed ? (
                  <div className="h-3 flex-1 rounded bg-slate-800" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UnifiedDashboardFrame({
  title,
  subtitle,
  children,
  navigation,
  activeHref,
  homeHref,
  workspaceLabel,
  userName,
  roleLabel,
  loading,
  onSignOut,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  navigation: UnifiedNavItem[];
  activeHref?: string | null;
  homeHref: string;
  workspaceLabel: string;
  userName: string;
  roleLabel?: string;
  loading?: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [collapsed, setCollapsed] =
    useState(false);

  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem(
          SIDEBAR_STORAGE_KEY,
        ) === "true",
      );
    } catch {
      // Storage may be unavailable.
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeHref]);

  function toggleSidebar() {
    setCollapsed((current) => {
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
    });
  }

  const groups =
    groupNavigation(navigation);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07111f] text-slate-100">
      <header className="fixed inset-x-0 top-0 z-[70] h-[74px] border-b border-slate-700/80 bg-[#1d2939]/95 shadow-[0_8px_30px_rgba(2,8,23,0.16)] backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-3 sm:px-5 lg:px-7">
          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) => !value,
              )
            }
            className="grid h-10 w-10 place-items-center rounded-[13px] border border-slate-600 bg-slate-800 text-slate-100 shadow-sm lg:hidden"
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
            href={homeHref}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-slate-950 ring-1 ring-white/10">
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
              <b className="block truncate text-[13px] tracking-[0.12em] text-white">
                ACADLYX
              </b>

              <small className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Education ERP
              </small>
            </span>
          </Link>

          <div className="ml-2 hidden min-w-0 border-l border-slate-600 pl-4 md:block lg:ml-3 lg:pl-5">
            <p className="truncate text-sm font-extrabold text-white">
              {title}
            </p>

            {subtitle ? (
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-2 hidden h-10 w-10 place-items-center rounded-[13px] border border-slate-600 bg-slate-800 text-slate-200 shadow-sm hover:border-blue-400 hover:text-blue-300 lg:grid"
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
              <p className="text-xs font-extrabold text-white">
                {userName}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-400">
                {roleLabel ||
                  workspaceLabel}
              </p>
            </div>

            <div className="rounded-[14px] border border-slate-600 bg-slate-800 shadow-sm">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={() =>
                void onSignOut()
              }
              className="hidden rounded-[14px] border border-slate-600 bg-slate-800 px-3.5 py-2.5 text-xs font-extrabold text-slate-100 shadow-sm hover:bg-slate-700 sm:block"
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
          className="fixed inset-0 z-[55] bg-slate-950/60 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-[74px] z-[60] border-r border-slate-800 bg-[#071525] shadow-[10px_0_34px_rgba(2,8,23,0.22)] transition-[width,transform] duration-200 ${
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
          <div
            className={`mb-4 rounded-[20px] border border-slate-700/80 bg-[#102137] ${
              collapsed
                ? "p-2"
                : "px-4 py-4"
            }`}
          >
            {collapsed ? (
              <div
                className="grid place-items-center"
                title={workspaceLabel}
              >
                <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-blue-600 text-xs font-black text-white">
                  {workspaceLabel
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                    "A"}
                </span>
              </div>
            ) : (
              <>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Live workspace
                </p>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-[15px] font-extrabold text-white">
                    {workspaceLabel}
                  </p>

                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]" />
                </div>
              </>
            )}
          </div>

          <nav
            className="flex-1 space-y-6 pb-5"
            aria-label="Workspace navigation"
          >
            {loading &&
            navigation.length === 0 ? (
              <SkeletonSidebar
                collapsed={collapsed}
              />
            ) : groups.length ? (
              groups.map(
                ([group, items]) => (
                  <section
                    key={group}
                  >
                    {!collapsed ? (
                      <p className="px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                        {group}
                      </p>
                    ) : null}

                    <div
                      className={`mt-2 ${
                        collapsed
                          ? "space-y-2"
                          : "space-y-1"
                      }`}
                    >
                      {items.map(
                        (item) => {
                          const isActive =
                            activeHref ===
                              item.href ||
                            (!activeHref &&
                              item.href !==
                                homeHref &&
                              typeof window !==
                                "undefined" &&
                              window.location.pathname.startsWith(
                                `${item.href}/`,
                              ));

                          return (
                            <Link
                              key={`${group}:${item.href}`}
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
                                  ? "bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)]"
                                  : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
                              }`}
                            >
                              <NavIcon
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
            ) : (
              <div className="mx-2 rounded-[18px] border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs font-bold text-slate-200">
                  Workspace loading
                </p>

                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Authorized modules will appear here automatically.
                </p>
              </div>
            )}
          </nav>

          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className={`flex min-h-[50px] w-full items-center rounded-[16px] text-left text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white ${
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
              <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-blue-500/10 text-blue-300">
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
              onClick={() =>
                void onSignOut()
              }
              className={`mt-1 flex min-h-[50px] w-full items-center rounded-[16px] text-left text-sm font-bold text-slate-300 hover:bg-red-500/10 hover:text-red-300 ${
                collapsed
                  ? "justify-center"
                  : "gap-3 px-2.5"
              }`}
              title="Sign out"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-red-500/10 text-red-300">
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
