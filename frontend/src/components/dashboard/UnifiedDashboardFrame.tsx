"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
  useRef,
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
  institutionLogoUrl?: string | null;
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
  institutionLogoUrl,
  collapsed,
}: {
  logoUrl?: string | null;
  institutionLogoUrl?: string | null;
  collapsed: boolean;
}) {
  return (
    <div className={collapsed ? "flex items-center justify-center" : "flex items-center gap-2.5"}>
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-white ring-1 ring-slate-200">
        {logoUrl ? (
          <img src={logoUrl} alt="ACADLYX logo" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[15px] font-extrabold text-blue-600">A</span>
        )}
      </div>
      {!collapsed ? (
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-white ring-1 ring-slate-200">
          {institutionLogoUrl ? (
            <img src={institutionLogoUrl} alt="Institution logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[11px] font-black text-slate-500">IN</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

