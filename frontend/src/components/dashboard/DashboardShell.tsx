"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type NavGroup = {
  label: string;
  items: NavItem[];
};

const roleNavigation: Record<string, NavGroup[]> = {
  STUDENT: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/student", icon: "⌂" },
      ],
    },
    {
      label: "Academics",
      items: [
        { label: "Timetable", href: "/student/timetable", icon: "▦" },
        { label: "Academic dates", href: "/student/calendar", icon: "◫" },
        { label: "Attendance", href: "/student/attendance", icon: "◷" },
        { label: "Assignments", href: "/student/assignments", icon: "✓" },
        { label: "Marks", href: "/student/marks", icon: "◈" },
        { label: "Results", href: "/results", icon: "◉" },
        { label: "Examinations", href: "/examinations", icon: "✍" },
        { label: "Course material", href: "/lms", icon: "▤" },
      ],
    },
    {
      label: "Services",
      items: [
        { label: "Fees", href: "/fees", icon: "₹" },
        {
          label: "Course registration",
          href: "/course-registration",
          icon: "⊞",
        },
        { label: "Library", href: "/library", icon: "❏" },
        { label: "Calendar", href: "/calendar", icon: "◫" },
        { label: "Certificates", href: "/certificates", icon: "❖" },
        { label: "Leave", href: "/leave-management", icon: "↗" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  FACULTY: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/faculty", icon: "⌂" },
      ],
    },
    {
      label: "Teaching",
      items: [
        { label: "Attendance", href: "/faculty/attendance", icon: "◷" },
        { label: "Assignments", href: "/faculty/assignments", icon: "✓" },
        { label: "Marks", href: "/faculty/marks", icon: "◈" },
        { label: "Results", href: "/results", icon: "◉" },
        { label: "Examinations", href: "/examinations", icon: "✍" },
        { label: "Course material", href: "/lms", icon: "▤" },
      ],
    },
    {
      label: "Services",
      items: [
        { label: "Library", href: "/library", icon: "❏" },
        { label: "Calendar", href: "/calendar", icon: "◫" },
        { label: "Leave", href: "/leave-management", icon: "↗" },
        { label: "Operations", href: "/operations", icon: "⚒" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  PARENT: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/parent", icon: "⌂" },
        { label: "My children", href: "/parent/children", icon: "♙" },
      ],
    },
    {
      label: "Services",
      items: [
        { label: "Calendar", href: "/calendar", icon: "◫" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  HOD: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/hod", icon: "⌂" },
        { label: "ERP operations", href: "/erp", icon: "▦" },
        { label: "Intelligence", href: "/intelligence", icon: "✦" },
      ],
    },
    {
      label: "Academics",
      items: [
        { label: "Examinations", href: "/examinations", icon: "✍" },
        {
          label: "Exam review",
          href: "/examinations/review",
          icon: "⚑",
        },
        { label: "Course material", href: "/lms", icon: "▤" },
        { label: "LMS administration", href: "/lms/admin", icon: "☷" },
        {
          label: "Attendance governance",
          href: "/attendance-governance",
          icon: "◷",
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
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Operations", href: "/operations", icon: "⚒" },
        {
          label: "Leave approvals",
          href: "/leave-management",
          icon: "↗",
        },
        { label: "Calendar", href: "/calendar", icon: "◫" },
      ],
    },
  ],

  MANAGEMENT: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/management", icon: "⌂" },
        { label: "ERP operations", href: "/erp", icon: "▦" },
        { label: "Intelligence", href: "/intelligence", icon: "✦" },
      ],
    },
    {
      label: "Institution",
      items: [
        { label: "Data import", href: "/imports", icon: "⇅" },
        { label: "Website CMS", href: "/site-content", icon: "◫" },
        { label: "Admissions", href: "/admissions", icon: "✎" },
        { label: "HR", href: "/hr", icon: "♙" },
        { label: "Library", href: "/library", icon: "❏" },
      ],
    },
    {
      label: "Academics",
      items: [
        { label: "Registrations", href: "/course-registration", icon: "⊞" },
        {
          label: "Student movement",
          href: "/student-promotion",
          icon: "⇗",
        },
        { label: "Certificates", href: "/certificates", icon: "❖" },
        { label: "Results", href: "/results", icon: "◉" },
        { label: "Examinations", href: "/examinations", icon: "✍" },
        {
          label: "Attendance governance",
          href: "/attendance-governance",
          icon: "◷",
        },
        {
          label: "Exam review",
          href: "/examinations/review",
          icon: "⚑",
        },
        { label: "LMS administration", href: "/lms/admin", icon: "☷" },
      ],
    },
    {
      label: "Finance & Operations",
      items: [
        { label: "Fees", href: "/fees", icon: "₹" },
        { label: "Fee administration", href: "/fees/admin", icon: "₹" },
        { label: "Operations", href: "/operations", icon: "⚒" },
        { label: "Calendar", href: "/calendar", icon: "◫" },
        { label: "Leave", href: "/leave-management", icon: "↗" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  DIRECTOR: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/director", icon: "⌂" },
        { label: "ERP operations", href: "/erp", icon: "▦" },
        { label: "Intelligence", href: "/intelligence", icon: "✦" },
      ],
    },
    {
      label: "Institution",
      items: [
        { label: "Data import", href: "/imports", icon: "⇅" },
        { label: "Website CMS", href: "/site-content", icon: "◫" },
        { label: "Admissions", href: "/admissions", icon: "✎" },
        { label: "HR", href: "/hr", icon: "♙" },
        { label: "Library", href: "/library", icon: "❏" },
      ],
    },
    {
      label: "Academics",
      items: [
        { label: "Registrations", href: "/course-registration", icon: "⊞" },
        {
          label: "Student movement",
          href: "/student-promotion",
          icon: "⇗",
        },
        { label: "Certificates", href: "/certificates", icon: "❖" },
        { label: "Results", href: "/results", icon: "◉" },
        { label: "Examinations", href: "/examinations", icon: "✍" },
        {
          label: "Attendance governance",
          href: "/attendance-governance",
          icon: "◷",
        },
        {
          label: "Exam review",
          href: "/examinations/review",
          icon: "⚑",
        },
        { label: "LMS administration", href: "/lms/admin", icon: "☷" },
      ],
    },
    {
      label: "Finance & Operations",
      items: [
        { label: "Fees", href: "/fees", icon: "₹" },
        { label: "Fee administration", href: "/fees/admin", icon: "₹" },
        { label: "Operations", href: "/operations", icon: "⚒" },
        { label: "Calendar", href: "/calendar", icon: "◫" },
        { label: "Leave", href: "/leave-management", icon: "↗" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  STAFF: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/staff", icon: "⌂" },
        { label: "ERP operations", href: "/erp", icon: "▦" },
      ],
    },
    {
      label: "Institution",
      items: [
        { label: "Data import", href: "/imports", icon: "⇅" },
        { label: "Admissions", href: "/admissions", icon: "✎" },
        { label: "Library", href: "/library", icon: "❏" },
        { label: "Certificates", href: "/certificates", icon: "❖" },
      ],
    },
    {
      label: "Finance & Operations",
      items: [
        { label: "Fees", href: "/fees", icon: "₹" },
        { label: "Operations", href: "/operations", icon: "⚒" },
        { label: "Calendar", href: "/calendar", icon: "◫" },
        { label: "Leave", href: "/leave-management", icon: "↗" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  INSTITUTION_ADMIN: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/admin", icon: "⌂" },
        {
          label: "People & users",
          href: "/user-management",
          icon: "♙",
        },
        { label: "ERP operations", href: "/erp", icon: "▦" },
        { label: "Intelligence", href: "/intelligence", icon: "✦" },
      ],
    },
    {
      label: "Institution",
      items: [
        { label: "Data import", href: "/imports", icon: "⇅" },
        { label: "Website CMS", href: "/site-content", icon: "◫" },
        { label: "Admissions", href: "/admissions", icon: "✎" },
        { label: "HR", href: "/hr", icon: "♙" },
        { label: "Library", href: "/library", icon: "❏" },
      ],
    },
    {
      label: "Academics",
      items: [
        { label: "Registrations", href: "/course-registration", icon: "⊞" },
        {
          label: "Student movement",
          href: "/student-promotion",
          icon: "⇗",
        },
        { label: "Certificates", href: "/certificates", icon: "❖" },
        { label: "Results", href: "/results", icon: "◉" },
        { label: "Examinations", href: "/examinations", icon: "✍" },
        {
          label: "Attendance governance",
          href: "/attendance-governance",
          icon: "◷",
        },
        {
          label: "Exam review",
          href: "/examinations/review",
          icon: "⚑",
        },
        { label: "LMS administration", href: "/lms/admin", icon: "☷" },
      ],
    },
    {
      label: "Finance & Operations",
      items: [
        { label: "Fees", href: "/fees", icon: "₹" },
        { label: "Fee administration", href: "/fees/admin", icon: "₹" },
        { label: "Operations", href: "/operations", icon: "⚒" },
        { label: "Calendar", href: "/calendar", icon: "◫" },
        { label: "Leave", href: "/leave-management", icon: "↗" },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  SUPER_ADMIN: [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/superadmin", icon: "⌂" },
        {
          label: "Platform administration",
          href: "/superadmin?section=institutions",
          icon: "◆",
        },
        {
          label: "Subscriptions",
          href: "/subscriptions",
          icon: "◇",
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Account security",
          href: "/account-security",
          icon: "◉",
        },
      ],
    },
  ],

  CMS: [
    {
      label: "Workspace",
      items: [
        {
          label: "Website CMS",
          href: "/site-content",
          icon: "◫",
        },
      ],
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

function getPrimaryRole(roles: string[]) {
  return (
    rolePriority.find((role) =>
      roles.includes(role)
    ) ||
    roles[0] ||
    ""
  );
}

function getRoleHome(roles: string[]) {
  switch (getPrimaryRole(roles)) {
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

function normalizeHref(href: string) {
  return href.split("?")[0];
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

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [collapsed, setCollapsed] =
    useState(false);

  const allowedRolesKey =
    allowedRoles?.join(",") || "";

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;

        if (
          allowedRoles?.length &&
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

        if (
          error instanceof AuthRequiredError
        ) {
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

    const previous =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [mobileOpen]);

  const roles =
    user?.roles ||
    allowedRoles ||
    [];

  const primaryRole =
    getPrimaryRole(roles);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const result: NavGroup[] = [];

    for (const role of rolePriority) {
      if (!roles.includes(role)) continue;

      for (
        const group of
          roleNavigation[role] || []
      ) {
        const items: NavItem[] = [];

        for (
          const item of group.items
        ) {
          const key =
            normalizeHref(
              item.href
            );

          if (seen.has(key)) continue;

          seen.add(key);
          items.push(item);
        }

        if (items.length) {
          result.push({
            label: group.label,
            items,
          });
        }
      }
    }

    return result;
  }, [roles.join(",")]);

  /*
   * IMPORTANT:
   *
   * Active navigation is determined by the SINGLE longest matching route.
   *
   * Therefore:
   *
   * /student/assignments
   *   -> Assignments only
   *
   * /student/assignments/123
   *   -> Assignments only
   *
   * /student
   *   -> Overview only
   *
   * This fixes the old "two buttons selected" behaviour.
   */
  const activeHref = useMemo(() => {
    let best = "";

    for (
      const group of groups
    ) {
      for (
        const item of group.items
      ) {
        const href =
          normalizeHref(
            item.href
          );

        const matches =
          pathname === href ||
          pathname.startsWith(
            `${href}/`
          );

        if (
          matches &&
          href.length >
            best.length
        ) {
          best = href;
        }
      }
    }

    return best;
  }, [groups, pathname]);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() =>
              setMobileOpen(
                (value) => !value
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
          >
            {mobileOpen ? (
              <span className="text-xl">
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-slate-500" />
                <span className="h-0.5 w-5 rounded-full bg-slate-500" />
                <span className="h-0.5 w-5 rounded-full bg-slate-500" />
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() =>
              setCollapsed(
                (value) => !value
              )
            }
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 lg:flex"
          >
            <span className="text-lg">
              {collapsed ? "›" : "‹"}
            </span>
          </button>

          <Link
            href={getRoleHome(roles)}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-900 shadow-sm">
              <Image
                src="/branding/acadlyx-logo.png"
                alt="ACADLYX"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>

            <div className="hidden sm:block">
              <p className="text-sm font-extrabold tracking-tight text-slate-900">
                ACADLYX
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Education ERP
              </p>
            </div>
          </Link>

          <div className="ml-3 hidden h-7 w-px bg-slate-200 md:block" />

          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-bold text-slate-900">
              {title}
            </p>
            {subtitle && (
              <p className="max-w-[520px] truncate text-xs text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right xl:block">
              <p className="text-xs font-bold text-slate-800">
                {user
                  ? `${user.firstName} ${user.lastName}`
                  : "Workspace"}
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
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed bottom-0 left-0 top-[72px] z-40",
          "border-r border-slate-200/80 bg-white",
          "transition-all duration-200",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
          collapsed
            ? "w-[78px]"
            : "w-[270px]",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div
            className={[
              "mb-5 rounded-2xl border border-blue-100",
              "bg-gradient-to-br from-blue-50 via-white to-indigo-50",
              collapsed
                ? "p-2"
                : "p-4",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-center gap-3",
                collapsed
                  ? "justify-center"
                  : "",
              ].join(" ")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm">
                {primaryRole
                  ? primaryRole
                      .charAt(0)
                      .toUpperCase()
                  : "A"}
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-blue-500">
                    Current workspace
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                    {roleLabels[
                      primaryRole
                    ] ||
                      "ACADLYX"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Simple. Connected. Fast.
                  </p>
                </div>
              )}
            </div>
          </div>

          <nav
            aria-label="Dashboard navigation"
            className="space-y-5"
          >
            {groups.map(
              (group) => (
                <section
                  key={
                    group.label
                  }
                >
                  {!collapsed && (
                    <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                      {group.label}
                    </p>
                  )}

                  <div className="space-y-1">
                    {group.items.map(
                      (item) => {
                        const active =
                          activeHref ===
                          normalizeHref(
                            item.href
                          );

                        return (
                          <Link
                            key={`${item.href}-${item.label}`}
                            href={
                              item.href
                            }
                            title={
                              collapsed
                                ? item.label
                                : undefined
                            }
                            onClick={() =>
                              setMobileOpen(
                                false
                              )
                            }
                            className={[
                              "group flex items-center gap-3 rounded-xl",
                              "px-3 py-2.5 text-sm font-semibold",
                              "transition-colors duration-150",
                              collapsed
                                ? "justify-center px-2"
                                : "",
                              active
                                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                                active
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-blue-600",
                              ].join(" ")}
                            >
                              {
                                item.icon
                              }
                            </span>

                            {!collapsed && (
                              <span className="truncate">
                                {
                                  item.label
                                }
                              </span>
                            )}
                          </Link>
                        );
                      }
                    )}
                  </div>
                </section>
              )
            )}
          </nav>

          {!collapsed && (
            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-900">
                  ACADLYX ERP
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Everything important,
                  without the clutter.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main
        className={[
          "min-h-screen pt-[72px] transition-[padding] duration-200",
          collapsed
            ? "lg:pl-[78px]"
            : "lg:pl-[270px]",
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
