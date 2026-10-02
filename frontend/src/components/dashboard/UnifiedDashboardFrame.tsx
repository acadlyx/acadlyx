"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";

export type UnifiedNavItem = {
  label: string;
  href: string;
  icon?: string;
  group?: string;
};

const SIDEBAR_STORAGE_KEY =
  "acadlyx-dashboard-sidebar-collapsed";

const SIDEBAR_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const HEADER_HEIGHT = 72;

const ICONS: Record<string, string> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  users:
    "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3.5 3.5 0 0 0 0-7M21 21v-2a4 4 0 0 0-3-3.87",

  calendar:
    "M6 3.5v3M18 3.5v3M4 8.5h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

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

  folder:
    "M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z",

  menu:
    "M4 6h16M4 12h16M4 18h16",

  close:
    "M6 6l12 12M18 6 6 18",

  chevronLeft:
    "M14 6l-6 6 6 6",

  chevronRight:
    "M10 6l6 6-6 6",

  logout:
    "M10 7v-1.5A2.5 2.5 0 0 1 12.5 3h6A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-6a2.5 2.5 0 0 1-2.5-2.5V17M3 12h11M10 8l4 4-4 4",
};

function normalizeIcon(icon?: string) {
  if (!icon) {
    return "home";
  }

  const normalized = icon.toLowerCase();

  if (ICONS[normalized]) {
    return normalized;
  }

  if (
    normalized.includes("notice") ||
    normalized.includes("announcement")
  ) {
    return "notice";
  }

  if (
    normalized.includes("people") ||
    normalized.includes("user")
  ) {
    return "people";
  }

  if (
    normalized.includes("calendar") ||
    normalized.includes("timetable")
  ) {
    return "calendar";
  }

  if (
    normalized.includes("security") ||
    normalized.includes("shield")
  ) {
    return "shield";
  }

  if (
    normalized.includes("academic") ||
    normalized.includes("course")
  ) {
    return "academic";
  }

  if (
    normalized.includes("report") ||
    normalized.includes("chart")
  ) {
    return "chart";
  }

  if (
    normalized.includes("setting") ||
    normalized.includes("config")
  ) {
    return "settings";
  }

  if (
    normalized.includes("document") ||
    normalized.includes("certificate")
  ) {
    return "document";
  }

  if (
    normalized.includes("library") ||
    normalized.includes("book")
  ) {
    return "book";
  }

  if (
    normalized.includes("notification") ||
    normalized.includes("bell")
  ) {
    return "bell";
  }

  if (
    normalized.includes("student") ||
    normalized.includes("class") ||
    normalized.includes("people")
  ) {
    return "people";
  }

  return "grid";
}

function groupNavigation(
  items: UnifiedNavItem[],
) {
  const groups = new Map<
    string,
    UnifiedNavItem[]
  >();

  for (const item of items) {
    const group =
      item.group?.trim() ||
      "Workspace";

    const current =
      groups.get(group) || [];

    current.push(item);

    groups.set(group, current);
  }

  return Array.from(groups.entries());
}

function NavIcon({
  item,
  active,
  collapsed,
}: {
  item: UnifiedNavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const iconName =
    normalizeIcon(item.icon);

  const path =
    ICONS[iconName] ||
    ICONS.grid;

  return (
    <span
      className={`grid shrink-0 place-items-center transition ${
        collapsed
          ? "h-10 w-10 rounded-[12px]"
          : "h-9 w-9 rounded-[11px]"
      } ${
        active
          ? "bg-white/15 text-white"
          : "bg-white/[0.06] text-slate-400 group-hover:bg-blue-500/10 group-hover:text-blue-300"
      }`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          collapsed
            ? "h-[18px] w-[18px]"
            : "h-[17px] w-[17px]"
        }
      >
        <path d={path} />
      </svg>
    </span>
  );
}

function SkeletonSidebar({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((group) => (
        <div key={group}>
          {!collapsed ? (
            <div className="mb-2 ml-2 h-2 w-16 rounded-full bg-slate-800" />
          ) : null}

          <div className="space-y-1">
            {[1, 2].map((item) => (
              <div
                key={item}
                className={`flex h-11 items-center ${
                  collapsed
                    ? "justify-center"
                    : "gap-3 px-2"
                }`}
              >
                <div className="h-9 w-9 rounded-[11px] bg-slate-800" />

                {!collapsed ? (
                  <div className="h-3 flex-1 rounded-full bg-slate-800" />
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
      const saved =
        window.localStorage.getItem(
          SIDEBAR_STORAGE_KEY,
        );

      setCollapsed(saved === "true");
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeHref]);

  const groups = useMemo(
    () => groupNavigation(navigation),
    [navigation],
  );

  const desktopSidebarWidth =
    collapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_WIDTH;

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          String(next),
        );
      } catch {
        // Ignore unavailable storage.
      }

      return next;
    });
  }

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      {/* =========================================================
          HEADER
         ========================================================= */}
      <header
        className="fixed inset-x-0 top-0 z-[100] border-b border-slate-700/70 bg-[#182536]/[0.97] shadow-[0_4px_24px_rgba(2,8,23,0.14)] backdrop-blur-xl"
        style={{
          height: HEADER_HEIGHT,
        }}
      >
        <div className="flex h-full items-center px-3 sm:px-5 lg:px-6">
          {/* Mobile menu */}
          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) => !value,
              )
            }
            className="mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-slate-600 bg-slate-800/80 text-slate-200 lg:hidden"
            aria-label={
              mobileOpen
                ? "Close navigation"
                : "Open navigation"
            }
            aria-expanded={mobileOpen}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-[19px] w-[19px]"
            >
              <path
                d={
                  mobileOpen
                    ? ICONS.close
                    : ICONS.menu
                }
              />
            </svg>
          </button>

          {/* Brand */}
          <Link
            href={homeHref}
            className="flex min-w-0 shrink-0 items-center gap-3"
            aria-label="ACADLYX workspace home"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#050b16] ring-1 ring-white/10">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={30}
                height={30}
                priority
                className="h-7 w-7 object-contain"
              />
            </span>

            <span className="hidden sm:block">
              <strong className="block text-[13px] font-black tracking-[0.12em] text-white">
                ACADLYX
              </strong>

              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Education ERP
              </span>
            </span>
          </Link>

          {/* Page title */}
          <div className="ml-4 hidden min-w-0 border-l border-slate-600/80 pl-4 md:block lg:ml-5 lg:pl-5">
            <p className="truncate text-[14px] font-extrabold text-white">
              {title}
            </p>

            {subtitle ? (
              <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.11em] text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-5 hidden h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-slate-600 bg-slate-800/80 text-slate-300 hover:border-blue-400 hover:bg-slate-700 hover:text-white lg:grid"
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
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />

              <path
                d={
                  collapsed
                    ? ICONS.chevronRight
                    : ICONS.chevronLeft
                }
              />
            </svg>
          </button>

          {/* User area */}
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right xl:block">
              <p className="max-w-[180px] truncate text-xs font-extrabold text-white">
                {userName}
              </p>

              <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-slate-400">
                {roleLabel ||
                  workspaceLabel}
              </p>
            </div>

            <div className="rounded-[12px] border border-slate-600 bg-slate-800/80">
              <AccountMenu />
            </div>

            <button
              type="button"
              onClick={() =>
                void onSignOut()
              }
              className="hidden rounded-[12px] border border-slate-600 bg-slate-800/80 px-3 py-2.5 text-xs font-extrabold text-slate-200 hover:bg-slate-700 hover:text-white sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MOBILE OVERLAY
         ========================================================= */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-[105] bg-slate-950/60 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      {/* =========================================================
          SIDEBAR
         ========================================================= */}
      <aside
        className={`fixed left-0 bottom-0 z-[110] border-r border-slate-800/90 bg-[#061525] shadow-[8px_0_30px_rgba(2,8,23,0.18)] transition-[width,transform] duration-200 ease-out ${
          collapsed
            ? "lg:w-[76px]"
            : "lg:w-[264px]"
        } ${
          mobileOpen
            ? "w-[264px] translate-x-0"
            : "w-[264px] -translate-x-full"
        } lg:translate-x-0`}
        style={{
          top: HEADER_HEIGHT,
        }}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Workspace identity */}
          <div
            className={`shrink-0 border-b border-slate-800/80 ${
              collapsed
                ? "px-2 py-4"
                : "px-3 py-4"
            }`}
          >
            <div
              className={`rounded-[17px] border border-slate-700/80 bg-[#0e2137] ${
                collapsed
                  ? "grid place-items-center p-2"
                  : "px-3.5 py-3.5"
              }`}
            >
              {collapsed ? (
                <span
                  className="grid h-10 w-10 place-items-center rounded-[12px] bg-blue-600 text-sm font-black text-white shadow-[0_7px_18px_rgba(37,99,235,0.22)]"
                  title={workspaceLabel}
                >
                  {workspaceLabel
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                    "A"}
                </span>
              ) : (
                <>
                  <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Live workspace
                  </p>

                  <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-extrabold text-white">
                      {workspaceLabel}
                    </p>

                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800"
            aria-label="Workspace navigation"
          >
            {loading &&
            navigation.length === 0 ? (
              <SkeletonSidebar
                collapsed={collapsed}
              />
            ) : groups.length > 0 ? (
              <div className="space-y-5">
                {groups.map(
                  ([group, items]) => (
                    <section
                      key={group}
                    >
                      {!collapsed ? (
                        <p className="mb-1.5 px-2 text-[8px] font-black uppercase tracking-[0.22em] text-slate-500">
                          {group}
                        </p>
                      ) : null}

                      <div className="space-y-0.5">
                        {items.map(
                          (item) => {
                            const isActive =
                              activeHref ===
                              item.href;

                            return (
                              <Link
                                key={`${group}:${item.href}`}
                                href={item.href}
                                onClick={
                                  closeMobileSidebar
                                }
                                title={
                                  collapsed
                                    ? item.label
                                    : undefined
                                }
                                className={`group relative flex min-h-[46px] items-center rounded-[13px] text-[13px] font-bold transition ${
                                  collapsed
                                    ? "justify-center px-1.5"
                                    : "gap-2.5 px-2"
                                } ${
                                  isActive
                                    ? "bg-blue-600 text-white shadow-[0_7px_18px_rgba(37,99,235,0.18)]"
                                    : "text-slate-300 hover:bg-slate-800/75 hover:text-white"
                                }`}
                                aria-current={
                                  isActive
                                    ? "page"
                                    : undefined
                                }
                              >
                                {isActive ? (
                                  <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full bg-white/90" />
                                ) : null}

                                <NavIcon
                                  item={item}
                                  active={
                                    isActive
                                  }
                                  collapsed={
                                    collapsed
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
                                      <span className="mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
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
                )}
              </div>
            ) : (
              <div className="rounded-[16px] border border-slate-800 bg-slate-900/50 p-3">
                {!collapsed ? (
                  <>
                    <p className="text-xs font-bold text-slate-200">
                      Workspace loading
                    </p>

                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      Authorized modules will appear here automatically.
                    </p>
                  </>
                ) : (
                  <span className="mx-auto block h-2 w-2 rounded-full bg-slate-600" />
                )}
              </div>
            )}
          </nav>

          {/* Bottom controls */}
          <div
            className={`shrink-0 border-t border-slate-800/90 ${
              collapsed
                ? "px-2 py-3"
                : "px-3 py-3"
            }`}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              className={`group flex min-h-[46px] w-full items-center rounded-[13px] text-left text-[13px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white ${
                collapsed
                  ? "justify-center px-1.5"
                  : "gap-2.5 px-2"
              }`}
              title={
                collapsed
                  ? "Show sidebar"
                  : "Hide sidebar"
              }
              aria-label={
                collapsed
                  ? "Show sidebar"
                  : "Hide sidebar"
              }
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-blue-500/10 text-blue-300 group-hover:bg-blue-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[17px] w-[17px]"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />

                  <path
                    d={
                      collapsed
                        ? ICONS.chevronRight
                        : ICONS.chevronLeft
                    }
                  />
                </svg>
              </span>

              {!collapsed ? (
                <span className="truncate">
                  Hide sidebar
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() =>
                void onSignOut()
              }
              className={`group mt-1 flex min-h-[46px] w-full items-center rounded-[13px] text-left text-[13px] font-bold text-slate-300 hover:bg-red-500/10 hover:text-red-300 ${
                collapsed
                  ? "justify-center px-1.5"
                  : "gap-2.5 px-2"
              }`}
              title="Sign out"
              aria-label="Sign out"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-red-500/10 text-red-300 group-hover:bg-red-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[17px] w-[17px]"
                >
                  <path d={ICONS.logout} />
                </svg>
              </span>

              {!collapsed ? (
                <span>Sign out</span>
              ) : null}
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================
          MAIN CONTENT
         ========================================================= */}
      <main
        className="min-h-screen"
        style={{
          paddingTop: HEADER_HEIGHT,
        }}
      >
        {/*
          IMPORTANT:
          Do NOT construct a Tailwind class such as:

          lg:pl-[${collapsed}px]

          Tailwind cannot reliably generate dynamic arbitrary
          values. Use explicit static classes below.
        */}
        <div
          className={
            collapsed
              ? "min-h-[calc(100vh-72px)] lg:pl-[76px]"
              : "min-h-[calc(100vh-72px)] lg:pl-[264px]"
          }
        >
          <div className="min-h-[calc(100vh-72px)] overflow-x-hidden bg-[radial-gradient(circle_at_72%_0%,rgba(37,99,235,0.07),transparent_30rem),linear-gradient(135deg,#f7faff,#eef4fa,#f8fbff)]">
            <div className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
