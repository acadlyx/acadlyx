"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { AccessNotice } from "@/components/dashboard/AccessNotice";
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
  permissions?: string[];
  description?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
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

const roleNavigation = (role: CanonicalRole): NavGroup[] => {
  const account: NavGroup = {
    label: "Account",
    items: [{ label: "Account & security", href: "/account-security" }],
  };

  const map: Record<CanonicalRole, NavGroup[]> = {
    SUPER_ADMIN: [
      {
        label: "Platform",
        items: [
          { label: "Overview", href: "/superadmin" },
          { label: "Institutions", href: "/superadmin", permissions: ["institutions.manage"] },
          { label: "Platform security", href: "/account-security" },
        ],
      },
    ],
    INSTITUTION_ADMIN: [
      {
        label: "Administration",
        items: [
          { label: "Overview", href: "/admin" },
          { label: "People & users", href: "/admin", permissions: ["users.read"] },
          { label: "Institution settings", href: "/institution-settings", permissions: ["institutions.manage"] },
          { label: "Students", href: "/students", permissions: ["students.read"] },
        ],
      },
      {
        label: "Academic setup",
        items: [
          { label: "Academic structure", href: "/erp", permissions: ["academic-masters.read"] },
          { label: "Data import", href: "/imports", permissions: ["imports.manage"] },
        ],
      },
    ],
    CHAIRMAN: [
      {
        label: "Leadership",
        items: [
          { label: "Overview", href: "/chairman" },
          { label: "Institution intelligence", href: "/intelligence", permissions: ["intelligence.read"] },
          { label: "Reports", href: "/reports", permissions: ["reports.read"] },
        ],
      },
    ],
    DIRECTOR: [
      {
        label: "Leadership",
        items: [
          { label: "Overview", href: "/director" },
          { label: "Institution intelligence", href: "/intelligence", permissions: ["intelligence.read"] },
          { label: "Reports", href: "/reports", permissions: ["reports.read"] },
        ],
      },
      {
        label: "Operations",
        items: [
          { label: "Admissions", href: "/admissions", permissions: ["admissions.read"] },
          { label: "Examinations", href: "/examinations", permissions: ["exams.read"] },
        ],
      },
    ],
    DEAN: [
      {
        label: "School",
        items: [
          { label: "Overview", href: "/dean" },
          { label: "Students", href: "/students", permissions: ["students.read"] },
          { label: "Academic intelligence", href: "/intelligence", permissions: ["intelligence.read"] },
        ],
      },
      {
        label: "Assessment",
        items: [
          { label: "Examinations", href: "/examinations", permissions: ["exams.read"] },
          { label: "Results", href: "/results", permissions: ["results.read"] },
        ],
      },
    ],
    REGISTRAR: [
      {
        label: "Student records",
        items: [
          { label: "Overview", href: "/registrar" },
          { label: "Enrollment", href: "/enrollment", permissions: ["students.read", "registration.read"] },
          { label: "Student movement", href: "/student-promotion", permissions: ["promotions.read"] },
          { label: "Certificates", href: "/certificates", permissions: ["certificates.read"] },
        ],
      },
      {
        label: "Registration",
        items: [
          { label: "Course registration", href: "/course-registration", permissions: ["registration.read"] },
        ],
      },
    ],
    HOD: [
      {
        label: "Department",
        items: [
          { label: "Overview", href: "/hod" },
          { label: "Students", href: "/students", permissions: ["students.read"] },
          { label: "Academic operations", href: "/erp", permissions: ["academic-masters.read"] },
          { label: "Student movement", href: "/student-promotion", permissions: ["promotions.read"] },
        ],
      },
      {
        label: "Assessment",
        items: [
          { label: "Examinations", href: "/examinations", permissions: ["exams.read"] },
          { label: "Intelligence", href: "/intelligence", permissions: ["intelligence.read"] },
        ],
      },
    ],
    FACULTY: [
      {
        label: "Teaching",
        items: [
          { label: "Overview", href: "/faculty" },
          { label: "Attendance", href: "/faculty/attendance", permissions: ["attendance.read"] },
          { label: "Assignments", href: "/faculty/assignments", permissions: ["assignments.read"] },
          { label: "Marks", href: "/faculty/marks", permissions: ["marks.read"] },
        ],
      },
      {
        label: "My work",
        items: [
          { label: "Examinations", href: "/examinations", permissions: ["exams.read"] },
          { label: "Calendar", href: "/calendar", permissions: ["calendar.read"] },
          { label: "Leave", href: "/leave-management", permissions: ["leave.read"] },
        ],
      },
    ],
    ACCOUNTS: [
      {
        label: "Finance",
        items: [
          { label: "Overview", href: "/accounts" },
          { label: "Fees & billing", href: "/fees", permissions: ["fees.read"] },
          { label: "Fee setup", href: "/erp?tab=fees", permissions: ["fees.manage"] },
          { label: "Reports", href: "/reports", permissions: ["reports.read"] },
        ],
      },
    ],
    HR: [
      {
        label: "People",
        items: [
          { label: "Overview", href: "/hr" },
          { label: "Employees", href: "/hr", permissions: ["hr.read"] },
          { label: "Leave", href: "/leave-management", permissions: ["leave.read"] },
          { label: "Calendar", href: "/calendar", permissions: ["calendar.read"] },
        ],
      },
    ],
    ADMISSIONS: [
      {
        label: "Admissions",
        items: [
          { label: "Overview", href: "/admissions" },
          { label: "Applications", href: "/applications", permissions: ["admissions.read"] },
        ],
      },
    ],
    EXAMINATION: [
      {
        label: "Examination",
        items: [
          { label: "Overview", href: "/examinations" },
          { label: "Examinations", href: "/examinations", permissions: ["exams.read"] },
          { label: "Results", href: "/results", permissions: ["results.read"] },
          { label: "Calendar", href: "/calendar", permissions: ["calendar.read"] },
        ],
      },
    ],
    LIBRARIAN: [
      {
        label: "Library",
        items: [
          { label: "Overview & circulation", href: "/library", permissions: ["library.read"] },
          { label: "Calendar", href: "/calendar", permissions: ["calendar.read"] },
        ],
      },
    ],
    PLACEMENT: [
      {
        label: "Placement",
        items: [
          { label: "Overview", href: "/placements" },
          { label: "Placement operations", href: "/placements", permissions: ["placement.read"] },
          { label: "Intelligence", href: "/intelligence", permissions: ["intelligence.read"] },
        ],
      },
    ],
    IT: [
      {
        label: "Technology",
        items: [
          { label: "Overview", href: "/it" },
          { label: "Operations", href: "/operations", permissions: ["operations.read"] },
        ],
      },
    ],
    CMS: [
      {
        label: "Website",
        items: [
          { label: "Content workspace", href: "/site-content", permissions: ["site.manage"] },
        ],
      },
    ],
    STUDENT: [
      {
        label: "My academics",
        items: [
          { label: "Overview", href: "/student" },
          { label: "Timetable", href: "/student/timetable", permissions: ["timetable.read"] },
          { label: "Attendance", href: "/student/attendance", permissions: ["attendance.read"] },
          { label: "Assignments", href: "/student/assignments", permissions: ["assignments.read"] },
          { label: "Marks & results", href: "/student/marks", permissions: ["marks.read"] },
        ],
      },
      {
        label: "Campus",
        items: [
          { label: "Examinations", href: "/examinations", permissions: ["exams.read"] },
          { label: "Course registration", href: "/course-registration", permissions: ["registration.read"] },
          { label: "Library", href: "/library", permissions: ["library.read"] },
          { label: "Academic dates", href: "/student/calendar", permissions: ["calendar.read"] },
        ],
      },
      {
        label: "My requests",
        items: [
          { label: "Fees", href: "/fees", permissions: ["fees.read"] },
          { label: "Certificates", href: "/certificates", permissions: ["certificates.read"] },
          { label: "Leave", href: "/leave-management", permissions: ["leave.read"] },
        ],
      },
    ],
    PARENT: [
      {
        label: "My family",
        items: [
          { label: "Overview", href: "/parent" },
          { label: "My children", href: "/parent/children", permissions: ["parent-links.read"] },
          { label: "Academic calendar", href: "/calendar", permissions: ["calendar.read"] },
        ],
      },
    ],
    CLUB_PRESIDENT: [
      {
        label: "Club",
        items: [
          { label: "Overview", href: "/club-president" },
          { label: "Club workspace", href: "/club-president", permissions: ["club.read"] },
          { label: "Calendar", href: "/calendar", permissions: ["calendar.read"] },
        ],
      },
    ],
  };

  return [...map[role], account];
};

function getPrimaryRole(roles: string[]): CanonicalRole | null {
  const normalized = normalizeRoles(roles);
  return ROLE_PRIORITY.find((role) => normalized.includes(role)) ?? null;
}

function initials(user: AuthUser | null): string {
  if (!user) return "A";
  return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "A";
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
  const [checkingAccess, setCheckingAccess] = useState(true);

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
        setUser(currentUser);
        setCheckingAccess(false);

        if (
          normalizedAllowedRoles.length &&
          !normalizedAllowedRoles.some((role) => roles.includes(role))
        ) {
          return;
        }
      })
      .catch((error) => {
        if (!mounted) return;
        if (error instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setCheckingAccess(false);
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
  const groups = useMemo(
    () => (primaryRole ? roleNavigation(primaryRole) : []),
    [primaryRole],
  );

  const visibleGroups = useMemo(() => {
    if (!user) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !item.permissions?.length || hasAnyPermission(user, item.permissions),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, user]);

  const allowed =
    !normalizedAllowedRoles.length ||
    (primaryRole ? normalizedAllowedRoles.includes(primaryRole) : true);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  function isActive(item: NavItem) {
    const [path] = item.href.split("?");
    if (pathname === path) return true;
    return pathname.startsWith(`${path}/`);
  }

  if (!checkingAccess && normalizedAllowedRoles.length && !allowed) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="mx-auto max-w-3xl pt-8 sm:pt-16">
          <AccessNotice
            title="This workspace isn't assigned to you"
            message="Your account is active, but this workspace belongs to a different responsibility. Use your own dashboard to see the tools and records available to you."
            homeHref={primaryRole ? ROLE_HOME[primaryRole] : "/login"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="shell-icon-button lg:hidden"
              aria-label="Open navigation"
            >
              <span className="text-lg">☰</span>
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="shell-icon-button hidden lg:inline-flex"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <span className="text-sm font-black">{collapsed ? "→" : "←"}</span>
            </button>
            <Link href={primaryRole ? ROLE_HOME[primaryRole] : "/"} className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black tracking-tight text-white">
                AX
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-tight">ACADLYX</p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {primaryRole ? ROLE_LABELS[primaryRole] : "Workspace"}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="hidden min-w-0 text-right md:block">
              <p className="truncate text-xs font-bold text-slate-800">
                {user ? `${user.firstName} ${user.lastName}`.trim() : "Loading…"}
              </p>
              <p className="truncate text-[11px] text-slate-500">{user?.email ?? ""}</p>
            </div>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700 sm:flex">
              {initials(user)}
            </div>
            <AccountMenu />
            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 top-[68px] z-50 w-[270px] border-r border-slate-200/80 bg-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-[86px]" : ""}`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className={`mb-4 rounded-2xl bg-slate-950 p-4 text-white ${collapsed ? "lg:hidden" : ""}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Your workspace</p>
            <p className="mt-1 text-sm font-black">{primaryRole ? ROLE_LABELS[primaryRole] : "Workspace"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Only tools assigned to your responsibility are shown.
            </p>
          </div>

          <nav className="space-y-5" aria-label="Workspace navigation">
            {visibleGroups.map((group) => (
              <section key={group.label}>
                <p className={`mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}>
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={`${item.href}:${item.label}`}
                        href={item.href}
                        title={collapsed ? item.label : item.description}
                        className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          collapsed ? "lg:justify-center lg:px-2" : ""
                        } ${
                          active
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        }`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                            active
                              ? "bg-white/15 text-white"
                              : "bg-slate-100 text-slate-500 group-hover:bg-white"
                          }`}
                        >
                          {item.label.slice(0, 1).toUpperCase()}
                        </span>
                        <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className={`mt-auto pt-5 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-800">Need help?</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                If a tool is missing, it is usually outside your assigned responsibility or data scope.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main
        className={`min-h-screen pt-[68px] transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[86px]" : "lg:pl-[270px]"
        }`}
      >
        <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1480px]">
            <div className="mb-6 flex flex-col gap-2 sm:mb-8">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                {primaryRole ? ROLE_LABELS[primaryRole] : "Workspace"}
              </p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
