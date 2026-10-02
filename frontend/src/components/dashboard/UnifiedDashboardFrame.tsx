"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const SIDEBAR_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const HEADER_HEIGHT = 72;

const SIDEBAR_STORAGE_KEY =
  "acadlyx-dashboard-sidebar-collapsed";

export type DashboardNavigationItem = {
  label: string;
  href: string;
  icon?: string;
  group?: string;
  badge?: string | number;
  children?: DashboardNavigationItem[];
};

type UnifiedDashboardFrameProps = {
  children: ReactNode;
  navigation?: DashboardNavigationItem[];
  title?: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  institutionName?: string;
  logoUrl?: string | null;
  onSignOut?: () => void | Promise<void>;
};

const ICONS: Record<string, string> = {
  home:
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",

  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  student:
    "M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",

  faculty:
    "M12 3 3 8l9 5 9-5-9-5ZM6 11v5c3 2.5 9 2.5 12 0v-5M20 9v7",

  academic:
    "M3 7.5 12 3l9 4.5-9 4.5-9-4.5ZM6 10.5V17c3.5 2.5 8.5 2.5 12 0v-6.5M21 8v7",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  timetable:
    "M4 5h16v14H4zM4 9h16M8 5v4M12 5v4M16 5v4M8 13h.01M12 13h.01M16 13h.01M8 16h.01M12 16h.01M16 16h.01",

  attendance:
    "M5 5h14v14H5zM8 12l2.5 2.5L16 9",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  exam:
    "M7 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8.5 8h7M8.5 12h7M8.5 16h4",

  reports:
    "M5 19V9M12 19V5M19 19v-7",

  fees:
    "M4 6h16v12H4zM4 10h16M8 15h3",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2.4-1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  document:
    "M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM14 3.5v5h4M8.5 12h7M8.5 15.5h7",

  shield:
    "M12 3.5 19 6v5.5c0 4.6-2.9 7.9-7 9.5-4.1-1.6-7-4.9-7-9.5V6l7-2.5ZM9 12l2 2 4-4",

  menu:
    "M4 7h16M4 12h16M4 17h16",

  close:
    "M6 6l12 12M18 6 6 18",

  chevron:
    "m9 18 6-6-6-6",

  logout:
    "M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5",

  download:
    "M12 3v12M7 10l5 5 5-5M5 21h14",

  user:
    "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",

  search:
    "m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15",

  // Legacy navigation identifiers are kept as aliases so older
  // navigation records render as icons instead of literal text.
  "⌂":
    "M4 10.5 12 4l8 6.5M6.5 9v9h11V9M9.5 18v-5h5v5",
  "▦":
    "M3 7.5 12 3l9 4.5-9 4.5-9-4.5ZM6 10.5V17c3.5 2.5 8.5 2.5 12 0v-6.5M21 8v7",
  "₹":
    "M4 6h16v12H4zM4 10h16M8 15h3",
  "♙":
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",
  "▤":
    "M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM14 3.5v5h4M8.5 12h7M8.5 15.5h7",
  "⇅":
    "M8 7h10M14 3l4 4-4 4M16 17H6M10 21l-4-4 4-4",
  "◉":
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  "✦":
    "m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  "◌":
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",
  "◫":
    "M5 4v3M19 4v3M4 8.5h16M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5Z",
  "⚙":
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7.8 7.8 0 0 0 2 1.2l.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2-1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  "◎":
    "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  "✍":
    "M5 19h4l10-10a2.8 2.8 0 0 0-4-4L5 15v4ZM13 6l5 5",
  "▥":
    "M5 4h14v16H5zM9 4v16M13 4v16M17 4v16",
  "✓":
    "M5 12l4 4L19 6",
};

export function SvgIcon({
  name,
  className = "h-[18px] w-[18px]",
}: {
  name?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICONS[name || "home"] || ICONS.home} />
    </svg>
  );
}

function matchesPath(
  pathname: string,
  href: string,
): boolean {
  if (!href || href === "#") {
    return false;
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

function flattenNavigation(
  items: DashboardNavigationItem[],
): DashboardNavigationItem[] {
  const output: DashboardNavigationItem[] = [];

  for (const item of items) {
    output.push(item);

    if (item.children?.length) {
      output.push(
        ...flattenNavigation(item.children),
      );
    }
  }

  return output;
}

function groupNavigation(
  items: DashboardNavigationItem[],
) {
  const groups = new Map<
    string,
    DashboardNavigationItem[]
  >();

  for (const item of items) {
    const group =
      item.group || "Workspace";

    const current =
      groups.get(group) || [];

    current.push(item);
    groups.set(group, current);
  }

  return Array.from(groups.entries());
}

function NavigationIcon({
  item,
  active,
}: {
  item: DashboardNavigationItem;
  active: boolean;
}) {
  return (
    <span
      className={[
        "grid h-10 w-10 shrink-0 place-items-center rounded-[13px] transition",
        active
          ? "bg-white/15 text-white"
          : "bg-white/5 text-[#aeb8c5] group-hover:bg-blue-500/15 group-hover:text-[#dbe7f5]",
      ].join(" ")}
    >
      <SvgIcon
        name={item.icon}
        className="h-[18px] w-[18px]"
      />
    </span>
  );
}

function NavigationItem({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: DashboardNavigationItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = matchesPath(
    pathname,
    item.href,
  );

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex min-h-[52px] items-center gap-3 rounded-[15px] px-2.5 transition-all duration-150",
        active
          ? "bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)]"
          : "text-[#d1d8e1] hover:bg-white/10 hover:text-white",
        collapsed
          ? "justify-center"
          : "justify-start",
      ].join(" ")}
    >
      <NavigationIcon
        item={item}
        active={active}
      />

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
            {item.label}
          </span>

          {item.badge !== undefined ? (
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                active
                  ? "bg-white/15 text-white"
                  : "bg-blue-500/15 text-blue-200",
              ].join(" ")}
            >
              {item.badge}
            </span>
          ) : null}

          {item.children?.length ? (
            <SvgIcon
              name="chevron"
              className="h-4 w-4 shrink-0 opacity-50"
            />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function BrandMark({
  logoUrl,
  collapsed,
}: {
  logoUrl?: string | null;
  collapsed: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center",
        collapsed
          ? "justify-center"
          : "gap-3",
      ].join(" ")}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-blue-600 text-white shadow-[0_7px_20px_rgba(37,99,235,0.25)]">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Institution logo"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[15px] font-extrabold tracking-tight">
            A
          </span>
        )}
      </div>

      {!collapsed ? (
        <div className="min-w-0">
          <div className="truncate text-[16px] font-extrabold tracking-tight text-white">
            ACADLYX
          </div>

          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9ca8b6]">
            Education Platform
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserAvatar({
  userName,
}: {
  userName?: string;
}) {
  const initials = useMemo(() => {
    const value =
      userName?.trim() || "User";

    const parts =
      value.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }, [userName]);

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500/15 text-[12px] font-bold text-[#cfe0f2]">
      {initials}
    </span>
  );
}

export function UnifiedDashboardFrame({
  children,
  navigation = [],
  title,
  subtitle,
  userName,
  userRole,
  userEmail,
  institutionName,
  logoUrl,
  onSignOut,
}: UnifiedDashboardFrameProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    userMenuOpen,
    setUserMenuOpen,
  ] = useState(false);

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
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        String(collapsed),
      );
    } catch {
      // Ignore localStorage failures.
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = () => {
      setMobileOpen(false);
      setUserMenuOpen(false);
    };

    window.addEventListener(
      "acadlyx:navigation-close",
      handler,
    );

    return () => {
      window.removeEventListener(
        "acadlyx:navigation-close",
        handler,
      );
    };
  }, []);

  const groupedNavigation =
    useMemo(
      () =>
        groupNavigation(
          navigation,
        ),
      [navigation],
    );

  const allNavigation =
    useMemo(
      () =>
        flattenNavigation(
          navigation,
        ),
      [navigation],
    );

  const activeItem =
    allNavigation.find((item) =>
      matchesPath(
        pathname,
        item.href,
      ),
    );

  const sidebarWidth =
    collapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_WIDTH;

  const handleSignOut =
    async () => {
      try {
        if (onSignOut) {
          await onSignOut();
        }
      } finally {
        router.push("/login");
      }
    };

  return (
    <div className="min-h-screen bg-[#e4eaf2]">
      {/* =========================================================
          DESKTOP HEADER
         ========================================================= */}
      <header
        className="fixed inset-x-0 top-0 z-[60] h-[72px] border-b border-[#d8d0c4] bg-[#fbf8f2] shadow-[0_2px_14px_rgba(70,55,40,0.08)]"
      >
        <div className="flex h-full items-center justify-between px-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setMobileOpen(true)
              }
              className="grid h-10 w-10 place-items-center rounded-[12px] text-slate-700 hover:bg-[#eee7dc] lg:hidden"
              aria-label="Open navigation"
            >
              <SvgIcon name="menu" />
            </button>

            <div className="hidden lg:block">
              <BrandMark
                logoUrl={logoUrl}
                collapsed={collapsed}
              />
            </div>

            <div className="min-w-0">
              {title ? (
                <div className="truncate text-[15px] font-bold text-slate-900 sm:text-[16px]">
                  {title}
                </div>
              ) : activeItem ? (
                <div className="truncate text-[15px] font-bold text-slate-900 sm:text-[16px]">
                  {activeItem.label}
                </div>
              ) : (
                <div className="truncate text-[15px] font-bold text-slate-900">
                  ACADLYX
                </div>
              )}

              {(subtitle ||
                institutionName) ? (
                <div className="hidden truncate text-[11px] font-medium text-slate-600 sm:block">
                  {subtitle ||
                    institutionName}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setUserMenuOpen(
                    (value) =>
                      !value,
                  )
                }
                className="flex items-center gap-2 rounded-[13px] px-1.5 py-1.5 hover:bg-[#eee7dc]"
                aria-expanded={
                  userMenuOpen
                }
              >
                <UserAvatar
                  userName={userName}
                />

                <span className="hidden max-w-[180px] text-left md:block">
                  <span className="block truncate text-[12px] font-bold text-slate-900">
                    {userName ||
                      "User"}
                  </span>

                  <span className="block truncate text-[10px] font-medium text-slate-400">
                    {userRole ||
                      "Account"}
                  </span>
                </span>

                <SvgIcon
                  name="chevron"
                  className={[
                    "hidden h-4 w-4 text-slate-400 transition-transform md:block",
                    userMenuOpen
                      ? "rotate-90"
                      : "",
                  ].join(" ")}
                />
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[280px] overflow-hidden rounded-[18px] border border-slate-200 bg-[#101a2d] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
                  <div className="rounded-[14px] bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        userName={userName}
                      />

                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold text-white">
                          {userName ||
                            "User"}
                        </div>

                        <div className="truncate text-[11px] text-[#a8b2bf]">
                          {userEmail ||
                            ""}
                        </div>
                      </div>
                    </div>

                    {userRole ? (
                      <div className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">
                        {userRole}
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href="/account-security"
                    className="mt-2 flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[12px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
                    onClick={() =>
                      setUserMenuOpen(
                        false,
                      )
                    }
                  >
                    <SvgIcon
                      name="shield"
                      className="h-4 w-4"
                    />
                    Account security
                  </Link>

                  <button
                    type="button"
                    onClick={
                      handleSignOut
                    }
                    className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[12px] font-semibold text-red-600 hover:bg-red-500/10"
                  >
                    <SvgIcon
                      name="logout"
                      className="h-4 w-4"
                    />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
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
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      {/* =========================================================
          SIDEBAR
         ========================================================= */}
      <aside
        className={[
          "fixed bottom-0 left-0 top-[72px] z-[75] border-r border-white/10 bg-[#0b1324] transition-all duration-200 ease-out",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{
          width: mobileOpen
            ? "min(264px, calc(100vw - 16px))"
            : `${sidebarWidth}px`,
        }}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header / mobile header */}
          <div className="flex h-[62px] items-center justify-between border-b border-white/10 px-3">
            <BrandMark
              logoUrl={logoUrl}
              collapsed={mobileOpen ? false : collapsed}
            />

            <button
              type="button"
              onClick={() =>
                setCollapsed((value) => !value)
              }
              className="hidden h-9 w-9 shrink-0 place-items-center rounded-[11px] text-slate-200 hover:bg-white/10 hover:text-white lg:grid"
              title={collapsed ? "Show sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Show sidebar" : "Collapse sidebar"}
            >
              <SvgIcon
                name="menu"
                className="h-5 w-5"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileOpen(false)
              }
              className="grid h-9 w-9 place-items-center rounded-[11px] text-slate-300 hover:bg-white/10 lg:hidden"
              aria-label="Close navigation"
            >
              <SvgIcon
                name="close"
                className="h-5 w-5"
              />
            </button>
          </div>

          {/* Navigation */}

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4">
            {groupedNavigation.length ===
            0 ? (
              <div className="px-2 py-4">
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex h-12 items-center gap-3 rounded-[14px] px-2.5"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-[13px] bg-white/10" />

                        {!collapsed ? (
                          <div className="h-3 flex-1 rounded bg-white/10" />
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <nav
                aria-label="Dashboard navigation"
                className="space-y-5"
              >
                {groupedNavigation.map(
                  ([group, items]) => (
                    <section
                      key={group}
                    >
                      {!collapsed ? (
                        <div className="mb-2 px-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#aeb8c5]">
                          {group}
                        </div>
                      ) : (
                        <div className="mb-2 h-px bg-white/10" />
                      )}

                      <div className="space-y-1">
                        {items.map(
                          (item) => (
                            <NavigationItem
                              key={`${item.href}-${item.label}`}
                              item={item}
                              pathname={
                                pathname
                              }
                              collapsed={
                                mobileOpen ? false : collapsed
                              }
                              onNavigate={() =>
                                setMobileOpen(
                                  false,
                                )
                              }
                            />
                          ),
                        )}
                      </div>
                    </section>
                  ),
                )}
              </nav>
            )}
          </div>

          {/* Bottom controls */}
          <div className="border-t border-white/10 p-2.5">
            <button
              type="button"
              onClick={
                handleSignOut
              }
              className={[
                "group mt-1 flex w-full items-center rounded-[14px] py-2.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/10",
                collapsed
                  ? "justify-center"
                  : "gap-3 px-2.5",
              ].join(" ")}
              title="Sign out"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-red-500/10 group-hover:bg-red-500/100/20">
                <SvgIcon
                  name="logout"
                  className="h-4 w-4"
                />
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

      {/* =========================================================
          MAIN CONTENT
         ========================================================= */}
      <main
        className="min-h-screen"
        style={{
          paddingTop:
            HEADER_HEIGHT,
        }}
      >
        {/*
          IMPORTANT:
          Sidebar width is applied with inline style rather than
          dynamically generated Tailwind arbitrary classes.

          This avoids:
            lg:pl-[${collapsed}px]

          which Tailwind cannot reliably compile.
        */}
        <div
          className="min-h-[calc(100vh-72px)] min-w-0 transition-[padding-left] duration-200 ease-out lg:pl-[var(--acadlyx-sidebar-width)]"
          style={{
            ["--acadlyx-sidebar-width" as string]:
              `${sidebarWidth}px`,
          }}
        >
          <div className="min-h-[calc(100vh-72px)] min-w-0 overflow-x-clip bg-[#eee7dc]">
            <div className="mx-auto w-full min-w-0 max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UnifiedDashboardFrame;
