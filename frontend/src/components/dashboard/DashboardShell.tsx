"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
} from "@/lib/auth";
import {
  CanonicalRole,
  hasAnyPermission,
  normalizeRoles,
} from "@/lib/authorization";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
};

const ROLE_PRIORITY: CanonicalRole[] = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "FACULTY",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
  "CMS",
  "STUDENT",
  "PARENT",
  "CLUB_PRESIDENT",
];

const ROLE_LABELS: Record<CanonicalRole, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Institution Admin",
  CHAIRMAN: "Chairman / Management",
  DIRECTOR: "Director",
  DEAN: "Dean",
  REGISTRAR: "Registrar",
  HOD: "Head of Department",
  FACULTY: "Faculty",
  ACCOUNTS: "Accounts",
  HR: "HR",
  ADMISSIONS: "Admissions",
  EXAMINATION: "Examination Cell",
  LIBRARIAN: "Librarian",
  PLACEMENT: "Placement",
  IT: "IT",
  CMS: "CMS",
  STUDENT: "Student",
  PARENT: "Parent",
  CLUB_PRESIDENT: "Club President",
};

const ROLE_HOME: Record<CanonicalRole, string> = {
  SUPER_ADMIN: "/superadmin",
  INSTITUTION_ADMIN: "/admin",
  CHAIRMAN: "/chairman",
  DIRECTOR: "/director",
  DEAN: "/dean",
  REGISTRAR: "/registrar",
  HOD: "/hod",
  FACULTY: "/faculty",
  ACCOUNTS: "/accounts",
  HR: "/hr",
  ADMISSIONS: "/admissions",
  EXAMINATION: "/examinations",
  LIBRARIAN: "/library",
  PLACEMENT: "/placements",
  IT: "/it",
  CMS: "/site-content",
  STUDENT: "/student",
  PARENT: "/parent",
  CLUB_PRESIDENT: "/club-president",
};

const ROLE_NAVIGATION: Record<CanonicalRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/superadmin", icon: "⌂" },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  INSTITUTION_ADMIN: [
    { label: "Dashboard", href: "/admin", icon: "⌂" },
    { label: "People & users", href: "/admin", icon: "♙", permissions: ["users.read"] },
    { label: "Institution settings", href: "/institution-settings", icon: "⚙", permissions: ["institutions.manage"] },
    { label: "Academic masters", href: "/erp", icon: "▦", permissions: ["academic-masters.read"] },
    { label: "Students", href: "/students", icon: "♙", permissions: ["students.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  CHAIRMAN: [
    { label: "Dashboard", href: "/chairman", icon: "⌂" },
    { label: "Intelligence", href: "/intelligence", icon: "✦", permissions: ["intelligence.read", "reports.read"] },
    { label: "Reports", href: "/reports", icon: "▤", permissions: ["reports.read"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  DIRECTOR: [
    { label: "Dashboard", href: "/director", icon: "⌂" },
    { label: "Intelligence", href: "/intelligence", icon: "✦", permissions: ["intelligence.read", "reports.read"] },
    { label: "Admissions", href: "/admissions", icon: "✎", permissions: ["admissions.read"] },
    { label: "Examinations", href: "/examinations", icon: "✍", permissions: ["exams.read"] },
    { label: "Reports", href: "/reports", icon: "▤", permissions: ["reports.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  DEAN: [
    { label: "Dashboard", href: "/dean", icon: "⌂" },
    { label: "Students", href: "/students", icon: "♙", permissions: ["students.read"] },
    { label: "Intelligence", href: "/intelligence", icon: "✦", permissions: ["intelligence.read", "reports.read"] },
    { label: "Examinations", href: "/examinations", icon: "✍", permissions: ["exams.read", "results.read"] },
    { label: "Results", href: "/results", icon: "◉", permissions: ["results.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  REGISTRAR: [
    { label: "Dashboard", href: "/registrar", icon: "⌂" },
    { label: "Enrollment", href: "/enrollment", icon: "♙", permissions: ["students.read", "students.manage", "registration.read", "registration.manage"] },
    { label: "Course registration", href: "/course-registration", icon: "⊞", permissions: ["registration.read", "registration.manage"] },
    { label: "Student movement", href: "/student-promotion", icon: "⇗", permissions: ["promotions.read", "promotions.manage"] },
    { label: "Certificates", href: "/certificates", icon: "❖", permissions: ["certificates.read", "certificates.manage"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  HOD: [
    { label: "Dashboard", href: "/hod", icon: "⌂" },
    { label: "Students", href: "/students", icon: "♙", permissions: ["students.read"] },
    { label: "Academic operations", href: "/erp", icon: "▦", permissions: ["academic-masters.read", "timetable.read"] },
    { label: "Examinations", href: "/examinations", icon: "✍", permissions: ["exams.read", "marks.read", "results.read"] },
    { label: "Student movement", href: "/student-promotion", icon: "⇗", permissions: ["promotions.read", "promotions.manage"] },
    { label: "Intelligence", href: "/intelligence", icon: "✦", permissions: ["intelligence.read", "reports.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  FACULTY: [
    { label: "Dashboard", href: "/faculty", icon: "⌂" },
    { label: "Attendance", href: "/faculty/attendance", icon: "◷", permissions: ["attendance.read", "attendance.manage"] },
    { label: "Assignments", href: "/faculty/assignments", icon: "✓", permissions: ["assignments.read", "assignments.manage"] },
    { label: "Marks", href: "/faculty/marks", icon: "◈", permissions: ["marks.read", "marks.manage"] },
    { label: "Examinations", href: "/examinations", icon: "✍", permissions: ["exams.read"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Leave", href: "/leave-management", icon: "⏻", permissions: ["leave.read", "leave.manage"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  ACCOUNTS: [
    { label: "Dashboard", href: "/accounts", icon: "⌂" },
    { label: "Fees & billing", href: "/fees", icon: "₹", permissions: ["fees.read", "fees.manage", "fees.pay"] },
    { label: "Fee configuration", href: "/erp?tab=fees", icon: "▦", permissions: ["fees.manage"] },
    { label: "Reports", href: "/reports", icon: "▤", permissions: ["reports.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  HR: [
    { label: "Dashboard", href: "/hr", icon: "⌂" },
    { label: "Employees", href: "/hr", icon: "♙", permissions: ["hr.read", "hr.manage"] },
    { label: "Leave management", href: "/leave-management", icon: "⏻", permissions: ["leave.read", "leave.manage"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  ADMISSIONS: [
    { label: "Dashboard", href: "/admissions", icon: "⌂" },
    { label: "Applications", href: "/applications", icon: "✎", permissions: ["admissions.read", "admissions.manage"] },
    { label: "Admissions", href: "/admissions", icon: "♙", permissions: ["admissions.read", "admissions.manage"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  EXAMINATION: [
    { label: "Dashboard", href: "/examinations", icon: "⌂" },
    { label: "Examinations", href: "/examinations", icon: "✍", permissions: ["exams.read", "exams.manage"] },
    { label: "Results", href: "/results", icon: "◉", permissions: ["results.read", "results.manage"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  LIBRARIAN: [
    { label: "Dashboard", href: "/library", icon: "⌂" },
    { label: "Library", href: "/library", icon: "❏", permissions: ["library.read", "library.manage", "library.borrow"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  PLACEMENT: [
    { label: "Dashboard", href: "/placements", icon: "⌂" },
    { label: "Placement operations", href: "/placements", icon: "◈", permissions: ["placement.read", "placement.manage"] },
    { label: "Intelligence", href: "/intelligence", icon: "✦", permissions: ["intelligence.read", "reports.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  IT: [
    { label: "Dashboard", href: "/it", icon: "⌂" },
    { label: "Operations", href: "/operations", icon: "⚒", permissions: ["operations.read", "operations.manage", "maintenance.read", "maintenance.manage"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  CMS: [
    { label: "Website CMS", href: "/site-content", icon: "◫", permissions: ["site.manage"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student", icon: "⌂" },
    { label: "Timetable", href: "/student/timetable", icon: "▦", permissions: ["timetable.read"] },
    { label: "Attendance", href: "/student/attendance", icon: "◷", permissions: ["attendance.read"] },
    { label: "Assignments", href: "/student/assignments", icon: "✓", permissions: ["assignments.read"] },
    { label: "Marks", href: "/student/marks", icon: "◈", permissions: ["marks.read"] },
    { label: "Results", href: "/results", icon: "◉", permissions: ["results.read"] },
    { label: "Examinations", href: "/examinations", icon: "✍", permissions: ["exams.read"] },
    { label: "Fees", href: "/fees", icon: "₹", permissions: ["fees.read", "fees.pay"] },
    { label: "Course registration", href: "/course-registration", icon: "⊞", permissions: ["registration.read", "registration.manage"] },
    { label: "Library", href: "/library", icon: "❏", permissions: ["library.read", "library.borrow"] },
    { label: "Certificates", href: "/certificates", icon: "❖", permissions: ["certificates.read"] },
    { label: "Leave", href: "/leave-management", icon: "⏻", permissions: ["leave.read", "leave.manage"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  PARENT: [
    { label: "Dashboard", href: "/parent", icon: "⌂" },
    { label: "My children", href: "/parent/children", icon: "♙", permissions: ["parent-links.read"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
  CLUB_PRESIDENT: [
    { label: "Dashboard", href: "/club-president", icon: "⌂" },
    { label: "Club workspace", href: "/club-president", icon: "♣", permissions: ["club.read", "club.manage"] },
    { label: "Calendar", href: "/calendar", icon: "◫", permissions: ["calendar.read"] },
    { label: "Account security", href: "/account-security", icon: "⛨" },
  ],
};

function getPrimaryRole(roles: string[]): CanonicalRole | null {
  const normalized = normalizeRoles(roles);
  return ROLE_PRIORITY.find((role) => normalized.includes(role)) ?? null;
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
  const cached = getCachedCurrentUser();
  const [user, setUser] = useState<AuthUser | null>(cached);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const normalizedAllowedRoles = useMemo(
    () => normalizeRoles(allowedRoles ?? []),
    [allowedRoles],
  );
  const allowedRolesKey = normalizedAllowedRoles.join(",");

  useEffect(() => {
    let mounted = true;

    getCurrentUser({ background: Boolean(cached) })
      .then((currentUser) => {
        if (!mounted) return;
        const roles = normalizeRoles(currentUser.roles);
        if (normalizedAllowedRoles.length && !normalizedAllowedRoles.some((role) => roles.includes(role))) {
          const target = getPrimaryRole(roles);
          router.replace(target ? ROLE_HOME[target] : "/login");
          return;
        }
        setUser(currentUser);
      })
      .catch((error) => {
        if (!mounted) return;
        if (error instanceof AuthRequiredError) router.replace("/login");
      });

    return () => {
      mounted = false;
    };
  }, [router, allowedRolesKey]);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const primaryRole = getPrimaryRole(user?.roles ?? normalizedAllowedRoles);
  const navItems = useMemo(() => {
    if (!primaryRole) return [];
    return ROLE_NAVIGATION[primaryRole].filter(
      (item) => !item.permissions?.length || (user ? hasAnyPermission(user, item.permissions) : false),
    );
  }, [primaryRole, user]);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  function isActive(item: NavItem) {
    if (pathname === item.href) return true;
    if (item.href.includes("?")) return false;
    return pathname.startsWith(`${item.href}/`);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm lg:hidden"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm lg:block"
              aria-label="Toggle sidebar"
            >
              {collapsed ? "→" : "←"}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight">ACADLYX</p>
              <p className="truncate text-xs text-slate-500">{primaryRole ? ROLE_LABELS[primaryRole] : "Workspace"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-slate-800">{user ? `${user.firstName} ${user.lastName}`.trim() : "Loading…"}</p>
              <p className="text-[11px] text-slate-500">{user?.email ?? ""}</p>
            </div>
            <AccountMenu />
            <button type="button" onClick={signOut} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`fixed bottom-0 left-0 top-[72px] z-50 w-[250px] border-r border-slate-200 bg-white transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "lg:w-[82px]" : ""}`}>
        <div className="flex h-full flex-col overflow-y-auto p-4">
          {primaryRole ? (
            <div className={`mb-4 rounded-2xl bg-slate-950 p-4 text-white ${collapsed ? "lg:hidden" : ""}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Current workspace</p>
              <p className="mt-1 text-sm font-black">{ROLE_LABELS[primaryRole]}</p>
            </div>
          ) : null}

          <nav className="space-y-1" aria-label="Workspace navigation">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link key={`${item.href}:${item.label}`} href={item.href} title={collapsed ? item.label : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${collapsed ? "lg:justify-center lg:px-2" : ""} ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} onClick={() => setMobileOpen(false)}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${active ? "bg-white/15" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
                  <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className={`min-h-screen pt-[72px] transition-[padding] duration-200 ${collapsed ? "lg:pl-[82px]" : "lg:pl-[250px]"}`}>
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{primaryRole ? ROLE_LABELS[primaryRole] : "Workspace"}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
