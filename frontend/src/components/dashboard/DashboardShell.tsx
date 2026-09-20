"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import {
  AuthRequiredError,
  type AuthUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  allowedRoles?: string[];
};

const roleNavigation: Record<string, NavItem[]> = {
  STUDENT: [
    {
      label: "Dashboard",
      href: "/student",
      icon: "⌂",
    },
    {
      label: "Timetable",
      href: "/student/timetable",
      icon: "▦",
    },
    {
      label: "Academic dates",
      href: "/student/calendar",
      icon: "◫",
    },
    {
      label: "Attendance",
      href: "/student/attendance",
      icon: "◷",
    },
    {
      label: "Assignments",
      href: "/student/assignments",
      icon: "✓",
    },
    {
      label: "Marks",
      href: "/student/marks",
      icon: "◈",
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
    },
    {
      label: "Course material",
      href: "/lms",
      icon: "▤",
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
    },
    {
      label: "Course registration",
      href: "/course-registration",
      icon: "⊞",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  FACULTY: [
    {
      label: "Dashboard",
      href: "/faculty",
      icon: "⌂",
    },
    {
      label: "Attendance",
      href: "/faculty/attendance",
      icon: "◷",
    },
    {
      label: "Assignments",
      href: "/faculty/assignments",
      icon: "✓",
    },
    {
      label: "Marks",
      href: "/faculty/marks",
      icon: "◈",
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
    },
    {
      label: "Course material",
      href: "/lms",
      icon: "▤",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Maintenance",
      href: "/operations",
      icon: "⚒",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  PARENT: [
    {
      label: "Dashboard",
      href: "/parent",
      icon: "⌂",
    },
    {
      label: "My children",
      href: "/parent/children",
      icon: "♙",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  HOD: [
    {
      label: "Dashboard",
      href: "/hod",
      icon: "⌂",
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
    },
    {
      label: "Course material",
      href: "/lms",
      icon: "▤",
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
    },
    {
      label: "Student movement",
      href: "/student-promotion",
      icon: "⇗",
    },
    {
      label: "Leave approvals",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
  ],

  MANAGEMENT: [
    {
      label: "Dashboard",
      href: "/management",
      icon: "⌂",
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
    },
    {
      label: "Data Import",
      href: "/imports",
      icon: "⇅",
    },
    {
      label: "Website CMS",
      href: "/site-content",
      icon: "◫",
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
    },
    {
      label: "HR",
      href: "/hr",
      icon: "♙",
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
    },
    {
      label: "Student movement",
      href: "/student-promotion",
      icon: "⇗",
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  DIRECTOR: [
    {
      label: "Dashboard",
      href: "/director",
      icon: "⌂",
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
    },
    {
      label: "Data Import",
      href: "/imports",
      icon: "⇅",
    },
    {
      label: "Website CMS",
      href: "/site-content",
      icon: "◫",
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
    },
    {
      label: "HR",
      href: "/hr",
      icon: "♙",
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
    },
    {
      label: "Student movement",
      href: "/student-promotion",
      icon: "⇗",
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  STAFF: [
    {
      label: "Dashboard",
      href: "/staff",
      icon: "⌂",
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
    },
    {
      label: "Data Import",
      href: "/imports",
      icon: "⇅",
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  INSTITUTION_ADMIN: [
    {
      label: "Dashboard",
      href: "/admin",
      icon: "⌂",
    },
    {
      label: "ERP Operations",
      href: "/erp",
      icon: "▦",
    },
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "✦",
    },
    {
      label: "Data Import",
      href: "/imports",
      icon: "⇅",
    },
    {
      label: "Website CMS",
      href: "/site-content",
      icon: "◫",
    },
    {
      label: "Admissions",
      href: "/admissions",
      icon: "✎",
    },
    {
      label: "HR",
      href: "/hr",
      icon: "♙",
    },
    {
      label: "Leave",
      href: "/leave-management",
      icon: "⏻",
    },
    {
      label: "Library",
      href: "/library",
      icon: "❏",
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: "◫",
    },
    {
      label: "Registrations",
      href: "/course-registration",
      icon: "⊞",
    },
    {
      label: "Student movement",
      href: "/student-promotion",
      icon: "⇗",
    },
    {
      label: "Certificates",
      href: "/certificates",
      icon: "❖",
    },
    {
      label: "Results",
      href: "/results",
      icon: "◉",
    },
    {
      label: "Examinations",
      href: "/examinations",
      icon: "✍",
    },
    {
      label: "Fees",
      href: "/fees",
      icon: "₹",
    },
    {
      label: "Operations",
      href: "/operations",
      icon: "⚒",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  SUPER_ADMIN: [
    {
      label: "Dashboard",
      href: "/superadmin",
      icon: "⌂",
    },
    {
      label: "Account security",
      href: "/account-security",
      icon: "⛨",
    },
  ],

  CMS: [
    {
      label: "Website CMS",
      href: "/site-content",
      icon: "◫",
    },
  ],
};

const roleLabels: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  PARENT: "Parent",
  HOD: "Head of Department",
  MANAGEMENT: "Management",
  DIRECTOR: "Director",
  STAFF: "Staff",
  INSTITUTION_ADMIN: "Institution Admin",
  SUPER_ADMIN: "Super Admin",
  CMS: "CMS",
};

const rolePriority = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
  "STAFF",
  "PARENT",
  "STUDENT",
  "CMS",
];

function getPrimaryRole(roles: string[]): string {
  return (
    rolePriority.find((role) => roles.includes(role)) ||
    roles[0] ||
    ""
  );
}

function getRoleHome(roles: string[]): string {
  const role = getPrimaryRole(roles);

  switch (role) {
    case "SUPER_ADMIN":
      return "/superadmin";

    case "INSTITUTION_ADMIN":
      return "/admin";

    case "DIRECTOR":
      return "/director";

    case "MANAGEMENT":
      return "/management";

    case "HOD":
      return "/hod";

    case "FACULTY":
      return "/faculty";

    case "STAFF":
      return "/staff";

    case "PARENT":
      return "/parent";

    case "STUDENT":
      return "/student";

    case "CMS":
      return "/site-content";

    default:
      return "/login";
  }
}

function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }

  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

function isNavigationItemActive(
  pathname: string,
  item: NavItem,
): boolean {
  const currentPath = normalizePath(pathname);
  const itemPath = normalizePath(item.href);

  if (itemPath === "/") {
    return currentPath === "/";
  }

  if (currentPath === itemPath) {
    return true;
  }

  return currentPath.startsWith(`${itemPath}/`);
}

function getUniqueNavigationItems(
  items: NavItem[],
): NavItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.href}::${item.label}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function DashboardLoadingState() {
  return (
    <div
      className="min-h-screen bg-slate-50"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />

            <div className="hidden space-y-2 sm:block">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          </div>

          <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="fixed bottom-0 left-0 top-[72px] w-[250px] border-r border-slate-200 bg-white">
          <div className="space-y-3 p-4">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />

            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-xl bg-slate-50"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-screen pt-[72px] lg:pl-[250px]">
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6 space-y-3">
            <div className="h-3 w-44 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  title,
  subtitle,
  children,
  allowedRoles,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const allowedRolesKey = useMemo(
    () => allowedRoles?.join(",") || "",
    [allowedRoles],
  );

  useEffect(() => {
    let mounted = true;

    setAuthChecking(true);

    getCurrentUser()
      .then((currentUser) => {
        if (!mounted) {
          return;
        }

        const hasRoleRestriction =
          Boolean(allowedRoles && allowedRoles.length > 0);

        const hasAllowedRole =
          !hasRoleRestriction ||
          currentUser.roles.some((role) =>
            allowedRoles?.includes(role),
          );

        if (!hasAllowedRole) {
          router.replace(
            getRoleHome(currentUser.roles),
          );
          return;
        }

        setUser(currentUser);
        setAuthChecking(false);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        if (error instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }

        setAuthChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, [allowedRolesKey, router, allowedRoles]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );
    };
  }, []);

  useEffect(() => {
    const stored =
      window.localStorage.getItem(
        "acadlyx.dashboard.sidebar.collapsed",
      );

    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "acadlyx.dashboard.sidebar.collapsed",
      String(collapsed),
    );
  }, [collapsed]);

  const primaryRole = useMemo(
    () => getPrimaryRole(user?.roles || allowedRoles || []),
    [user?.roles, allowedRoles],
  );

  const navItems = useMemo(() => {
    const roles = user?.roles || allowedRoles || [];

    const mergedItems = roles.flatMap(
      (role) => roleNavigation[role] || [],
    );

    return getUniqueNavigationItems(
      mergedItems.length > 0
        ? mergedItems
        : roleNavigation[primaryRole] || [],
    );
  }, [allowedRoles, primaryRole, user?.roles]);

  const signOut = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  if (authChecking || !user) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {/* =========================================================
          GLOBAL DASHBOARD HEADER
          ========================================================= */}
      <header className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-slate-200/90 bg-white/95 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Mobile menu */}
            <button
              type="button"
              aria-label={
                mobileOpen
                  ? "Close navigation"
                  : "Open navigation"
              }
              aria-expanded={mobileOpen}
              onClick={() =>
                setMobileOpen((value) => !value)
              }
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/30 lg:hidden"
            >
              {mobileOpen ? (
                <span className="text-xl leading-none">
                  ×
                </span>
              ) : (
                <span className="flex flex-col gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                </span>
              )}
            </button>

            {/* Desktop collapse */}
            <button
              type="button"
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              aria-expanded={!collapsed}
              onClick={() =>
                setCollapsed((value) => !value)
              }
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/30 lg:inline-flex"
            >
              <span className="text-lg leading-none">
                {collapsed ? "→" : "←"}
              </span>
            </button>

            {/* Brand */}
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-slate-50"
              aria-label="ACADLYX home"
            >
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Image
                  src="/logo.png"
                  alt="ACADLYX"
                  fill
                  sizes="36px"
                  className="object-contain p-1.5"
                  priority
                />
              </div>

              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-black tracking-tight text-slate-950">
                  ACADLYX
                </p>

                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Institutional Platform
                </p>
              </div>
            </Link>

            {/* Current page */}
            <div className="hidden h-8 w-px bg-slate-200 md:block" />

            <div className="hidden min-w-0 md:block">
              <p className="max-w-[300px] truncate text-sm font-bold text-slate-900">
                {title}
              </p>

              {subtitle ? (
                <p className="max-w-[420px] truncate text-xs text-slate-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden lg:block">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {roleLabels[primaryRole] ||
                  "Authenticated"}
              </span>
            </div>

            <AccountMenu user={user} />

            <button
              type="button"
              onClick={signOut}
              className="hidden h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 sm:inline-flex"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MOBILE BACKDROP
          ========================================================= */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      {/* =========================================================
          GLOBAL SIDEBAR
          ========================================================= */}
      <aside
        aria-label="Dashboard navigation"
        className={[
          "fixed bottom-0 left-0 top-[72px] z-40",
          "border-r border-slate-200/90 bg-white",
          "shadow-[8px_0_30px_rgba(15,23,42,0.04)]",
          "transition-[width,transform] duration-200 ease-out",
          "lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
          collapsed
            ? "lg:w-[82px]"
            : "w-[280px] lg:w-[250px]",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto p-3">
          {/* Workspace identity */}
          <div
            className={[
              "mb-5 rounded-2xl border border-slate-100",
              "bg-gradient-to-br from-sky-50 via-white to-violet-50",
              "p-3",
              collapsed ? "lg:p-2" : "",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-center gap-3",
                collapsed
                  ? "lg:justify-center"
                  : "",
              ].join(" ")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-sm font-black text-white shadow-sm">
                {primaryRole
                  ? primaryRole
                      .charAt(0)
                      .toUpperCase()
                  : "A"}
              </div>

              <div
                className={
                  collapsed
                    ? "lg:hidden"
                    : ""
                }
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Workspace
                </p>

                <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                  {roleLabels[primaryRole] ||
                    "ACADLYX"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav
            aria-label="Dashboard navigation links"
            className="space-y-1"
          >
            {navItems.map((item) => {
              const active =
                isNavigationItemActive(
                  pathname,
                  item,
                );

              return (
                <Link
                  key={`${item.href}::${item.label}`}
                  href={item.href}
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    setMobileOpen(false)
                  }
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5",
                    "text-sm font-semibold transition-all duration-150",
                    "focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                    collapsed
                      ? "lg:justify-center lg:px-2"
                      : "",
                    active
                      ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700",
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>

                  <span
                    className={
                      collapsed
                        ? "lg:hidden"
                        : ""
                    }
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div
            className={[
              "mt-auto pt-5",
              collapsed ? "lg:hidden" : "",
            ].join(" ")}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold text-slate-900">
                  ACADLYX
                </p>

                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                  Live
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Education ERP & institutional
                intelligence platform.
              </p>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="mt-3 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 lg:hidden"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================
          MAIN CONTENT
          ========================================================= */}
      <main
        className={[
          "min-h-screen pt-[72px]",
          "transition-[padding] duration-200",
          collapsed
            ? "lg:pl-[82px]"
            : "lg:pl-[250px]",
        ].join(" ")}
      >
        <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
