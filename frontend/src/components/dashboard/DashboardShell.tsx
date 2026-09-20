"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

const roleNavigation: Record<string, NavItem[]> = {
  STUDENT: [
    { label: "Dashboard", href: "/student", icon: "⌂" },
    { label: "Timetable", href: "/student/timetable", icon: "▦" },
    { label: "Academic dates", href: "/student/calendar", icon: "◫" },
    { label: "Attendance", href: "/student/attendance", icon: "◷" },
    { label: "Assignments", href: "/student/assignments", icon: "✓" },
    { label: "Marks", href: "/student/marks", icon: "◈" },
    { label: "Results", href: "/results", icon: "◉" },
    { label: "Examinations", href: "/examinations", icon: "✍" },
    { label: "Course material", href: "/lms", icon: "▤" },
    { label: "Fees", href: "/fees", icon: "₹" },
    { label: "Course registration", href: "/course-registration", icon: "⊞" },
    { label: "Library", href: "/library", icon: "❏" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Certificates", href: "/certificates", icon: "❖" },
    { label: "Leave", href: "/leave-management", icon: "⏻" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  FACULTY: [
    { label: "Dashboard", href: "/faculty", icon: "⌂" },
    { label: "Attendance", href: "/faculty/attendance", icon: "◷" },
    { label: "Assignments", href: "/faculty/assignments", icon: "✓" },
    { label: "Marks", href: "/faculty/marks", icon: "◈" },
    { label: "Results", href: "/results", icon: "◉" },
    { label: "Examinations", href: "/examinations", icon: "✍" },
    { label: "Course material", href: "/lms", icon: "▤" },
    { label: "Library", href: "/library", icon: "❏" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Leave", href: "/leave-management", icon: "⏻" },
    { label: "Maintenance", href: "/operations", icon: "⚒" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  PARENT: [
    { label: "Dashboard", href: "/parent", icon: "⌂" },
    { label: "My children", href: "/parent/children", icon: "♙" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  HOD: [
    { label: "Dashboard", href: "/hod", icon: "⌂" },
    { label: "ERP Operations", href: "/erp", icon: "▦" },
    { label: "Intelligence", href: "/intelligence", icon: "✦" },
    { label: "Examinations", href: "/examinations", icon: "✍" },
    { label: "Course material", href: "/lms", icon: "▤" },
    { label: "Operations", href: "/operations", icon: "⚒" },
    { label: "Registrations", href: "/course-registration", icon: "⊞" },
    { label: "Student movement", href: "/student-promotion", icon: "⇗" },
    { label: "Leave approvals", href: "/leave-management", icon: "⏻" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
  ],

  MANAGEMENT: [
    { label: "Dashboard", href: "/management", icon: "⌂" },
    { label: "ERP Operations", href: "/erp", icon: "▦" },
    { label: "Intelligence", href: "/intelligence", icon: "✦" },
    { label: "Data Import", href: "/imports", icon: "⇅" },
    { label: "Admissions", href: "/admissions", icon: "✎" },
    { label: "HR", href: "/hr", icon: "♙" },
    { label: "Leave", href: "/leave-management", icon: "⏻" },
    { label: "Library", href: "/library", icon: "❏" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Registrations", href: "/course-registration", icon: "⊞" },
    { label: "Student movement", href: "/student-promotion", icon: "⇗" },
    { label: "Certificates", href: "/certificates", icon: "❖" },
    { label: "Results", href: "/results", icon: "◉" },
    { label: "Examinations", href: "/examinations", icon: "✍" },
    { label: "Fees", href: "/fees", icon: "₹" },
    { label: "Operations", href: "/operations", icon: "⚒" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  DIRECTOR: [
    { label: "Dashboard", href: "/director", icon: "⌂" },
    { label: "ERP Operations", href: "/erp", icon: "▦" },
    { label: "Intelligence", href: "/intelligence", icon: "✦" },
    { label: "Data Import", href: "/imports", icon: "⇅" },
    { label: "Admissions", href: "/admissions", icon: "✎" },
    { label: "HR", href: "/hr", icon: "♙" },
    { label: "Leave", href: "/leave-management", icon: "⏻" },
    { label: "Library", href: "/library", icon: "❏" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Registrations", href: "/course-registration", icon: "⊞" },
    { label: "Student movement", href: "/student-promotion", icon: "⇗" },
    { label: "Certificates", href: "/certificates", icon: "❖" },
    { label: "Results", href: "/results", icon: "◉" },
    { label: "Examinations", href: "/examinations", icon: "✍" },
    { label: "Fees", href: "/fees", icon: "₹" },
    { label: "Operations", href: "/operations", icon: "⚒" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  STAFF: [
    { label: "Dashboard", href: "/staff", icon: "⌂" },
    { label: "ERP Operations", href: "/erp", icon: "▦" },
    { label: "Data Import", href: "/imports", icon: "⇅" },
    { label: "Admissions", href: "/admissions", icon: "✎" },
    { label: "Library", href: "/library", icon: "❏" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Certificates", href: "/certificates", icon: "❖" },
    { label: "Leave", href: "/leave-management", icon: "⏻" },
    { label: "Fees", href: "/fees", icon: "₹" },
    { label: "Operations", href: "/operations", icon: "⚒" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  INSTITUTION_ADMIN: [
    { label: "Dashboard", href: "/admin", icon: "⌂" },
    { label: "People & Users", href: "/admin", icon: "♙" },
    { label: "ERP Operations", href: "/erp", icon: "▦" },
    { label: "Intelligence", href: "/intelligence", icon: "✦" },
    { label: "Data Import", href: "/imports", icon: "⇅" },
    { label: "Admissions", href: "/admissions", icon: "✎" },
    { label: "HR", href: "/hr", icon: "♙" },
    { label: "Leave", href: "/leave-management", icon: "⏻" },
    { label: "Library", href: "/library", icon: "❏" },
    { label: "Calendar", href: "/calendar", icon: "◫" },
    { label: "Registrations", href: "/course-registration", icon: "⊞" },
    { label: "Student movement", href: "/student-promotion", icon: "⇗" },
    { label: "Certificates", href: "/certificates", icon: "❖" },
    { label: "Results", href: "/results", icon: "◉" },
    { label: "Examinations", href: "/examinations", icon: "✍" },
    { label: "Fees", href: "/fees", icon: "₹" },
    { label: "Operations", href: "/operations", icon: "⚒" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  SUPER_ADMIN: [
    { label: "Dashboard", href: "/superadmin", icon: "⌂" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],

  CMS: [
    { label: "Website CMS", href: "/site-content", icon: "◫" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
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
  CMS: "Website CMS Manager",
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

function getPrimaryRole(roles: string[]) {
  return (
    rolePriority.find((role) => roles.includes(role)) ||
    roles[0] ||
    ""
  );
}

function getRoleHome(roles: string[]) {
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
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const allowedRolesKey = allowedRoles?.join(",") || "";

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;

        if (
          allowedRoles &&
          allowedRoles.length > 0 &&
          !currentUser.roles.some((role) =>
            allowedRoles.includes(role)
          )
        ) {
          router.replace(
            getRoleHome(currentUser.roles)
          );
          return;
        }

        setUser(currentUser);
      })
      .catch((error) => {
        if (!mounted) return;

        if (error instanceof AuthRequiredError) {
          router.replace("/login");
        }
      });

    return () => {
      mounted = false;
    };
  }, [router, allowedRolesKey]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileOpen]);

  const primaryRole = getPrimaryRole(
    user?.roles || allowedRoles || []
  );

  const navItems = useMemo(() => {
    const roles =
      user?.roles ||
      allowedRoles ||
      [];

    const result: NavItem[] = [];
    const seen = new Set<string>();

    for (const role of rolePriority) {
      if (!roles.includes(role)) continue;

      for (const item of roleNavigation[role] || []) {
        if (seen.has(item.href)) continue;

        seen.add(item.href);
        result.push(item);
      }
    }

    for (const role of roles) {
      for (const item of roleNavigation[role] || []) {
        if (seen.has(item.href)) continue;

        seen.add(item.href);
        result.push(item);
      }
    }

    return result;
  }, [user?.roles, allowedRolesKey]);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  function isActive(item: NavItem) {
    if (item.href === "/student") {
      return (
        pathname === "/student" ||
        pathname.startsWith("/student/")
      );
    }

    if (item.href === "/faculty") {
      return (
        pathname === "/faculty" ||
        pathname.startsWith("/faculty/")
      );
    }

    if (
      item.href === "/admin" ||
      item.href === "/superadmin"
    ) {
      return pathname === item.href;
    }

    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      {/* Top header */}
      <header className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          {/* Mobile menu */}
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() =>
              setMobileOpen((value) => !value)
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
          >
            {mobileOpen ? (
              <span className="text-xl leading-none">
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-slate-700" />
                <span className="h-0.5 w-5 rounded-full bg-slate-700" />
                <span className="h-0.5 w-5 rounded-full bg-slate-700" />
              </span>
            )}
          </button>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() =>
              setCollapsed((value) => !value)
            }
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:flex"
          >
            <span className="text-lg font-medium">
              {collapsed ? "›" : "‹"}
            </span>
          </button>

          {/* Brand */}
          <Link
            href={getRoleHome(
              user?.roles || allowedRoles || []
            )}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-extrabold tracking-tight text-slate-950">
                ACADLYX
              </p>
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Institutional intelligence
              </p>
            </div>
          </Link>

          {/* Current page */}
          <div className="ml-3 hidden min-w-0 md:block">
            <div className="h-6 w-px bg-slate-200" />
          </div>

          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-bold text-slate-900">
              {title}
            </p>

            {subtitle && (
              <p className="max-w-[500px] truncate text-xs text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          {/* Account */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-bold text-slate-800">
                {user
                  ? `${user.firstName} ${user.lastName}`
                  : "Loading…"}
              </p>

              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {roleLabels[primaryRole] ||
                  primaryRole.replace(
                    /_/g,
                    " "
                  )}
              </p>
            </div>

            <AccountMenu />

            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed bottom-0 left-0 top-[72px] z-40",
          "border-r border-slate-200/80",
          "bg-white",
          "transition-all duration-200",
          "lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
          collapsed
            ? "lg:w-[82px]"
            : "w-[270px] lg:w-[250px]",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto p-3">
          {/* Workspace identity */}
          <div
            className={`mb-5 rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-3 ${
              collapsed ? "lg:p-2" : ""
            }`}
          >
            <div
              className={`flex items-center gap-3 ${
                collapsed
                  ? "lg:justify-center"
                  : ""
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-sm font-black text-white">
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
            aria-label="Dashboard navigation"
            className="space-y-1"
          >
            {navItems.map((item) => {
              const active =
                isActive(item);

              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  onClick={() =>
                    setMobileOpen(false)
                  }
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5",
                    "text-sm font-semibold transition-all",
                    collapsed
                      ? "lg:justify-center lg:px-2"
                      : "",
                    active
                      ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-white",
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

          {/* Bottom identity card */}
          <div
            className={`mt-auto pt-5 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold text-slate-900">
                ACADLYX
              </p>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Education ERP & institutional
                intelligence platform.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={[
          "min-h-screen pt-[72px] transition-[padding] duration-200",
          collapsed
            ? "lg:pl-[82px]"
            : "lg:pl-[250px]",
        ].join(" ")}
      >
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
