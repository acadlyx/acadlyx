"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { AuthRequiredError, AuthUser, getCurrentUser, logout } from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
  description?: string;
};

const roleNavigation: Record<string, NavItem[]> = {
  STUDENT: [
    { label: "Overview", href: "/student" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Marks", href: "/student/marks" },
    { label: "Assignments", href: "/student/assignments" },
    { label: "Placements", href: "/placements" },
  ],

  FACULTY: [
    { label: "Overview", href: "/faculty" },
    { label: "Assignments", href: "/faculty/assignments" },
    { label: "Attendance", href: "/faculty/attendance" },
    { label: "Marks", href: "/faculty/marks" },
  ],

  PARENT: [
    { label: "Overview", href: "/parent" },
  ],

  HOD: [
    { label: "Overview", href: "/hod" },
    { label: "ERP Operations", href: "/erp" },
    { label: "Intelligence", href: "/intelligence" },
    { label: "Placements", href: "/placements" },
    { label: "Data Import", href: "/imports" },
  ],

  MANAGEMENT: [
    { label: "Overview", href: "/management" },
    { label: "ERP Operations", href: "/erp" },
    { label: "Intelligence", href: "/intelligence" },
    { label: "Placements", href: "/placements" },
    { label: "Data Import", href: "/imports" },
    { label: "Website CMS", href: "/site-content" },
  ],

  DIRECTOR: [
    { label: "Overview", href: "/director" },
    { label: "ERP Operations", href: "/erp" },
    { label: "Intelligence", href: "/intelligence" },
    { label: "Placements", href: "/placements" },
    { label: "Data Import", href: "/imports" },
    { label: "Website CMS", href: "/site-content" },
  ],

  STAFF: [
    { label: "Overview", href: "/staff" },
    { label: "ERP Operations", href: "/erp" },
    { label: "Data Import", href: "/imports" },
  ],

  INSTITUTION_ADMIN: [
    { label: "Overview", href: "/admin" },
    { label: "ERP Operations", href: "/erp" },
    { label: "People", href: "/admin" },
    { label: "Intelligence", href: "/intelligence" },
    { label: "Placements", href: "/placements" },
    { label: "Data Import", href: "/imports" },
    { label: "Website CMS", href: "/site-content" },
  ],

  SUPER_ADMIN: [
    { label: "Platform", href: "/superadmin" },
    { label: "Institutions", href: "/superadmin" },
    { label: "Platform Users", href: "/superadmin" },
  ],

  CMS: [
    { label: "Website CMS", href: "/site-content" },
  ],
};

const fallbackNavigation: NavItem[] = [
  { label: "Overview", href: "/" },
];

const roleLabels: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  PARENT: "Parent",
  HOD: "HOD",
  MANAGEMENT: "Management",
  DIRECTOR: "Director",
  STAFF: "Staff",
  INSTITUTION_ADMIN: "Institution Admin",
  SUPER_ADMIN: "Super Admin",
  CMS: "CMS",
};

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const allowedRolesKey = allowedRoles?.join(",") ?? "";

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;

        const hasRequiredRole =
          !allowedRoles ||
          allowedRoles.length === 0 ||
          currentUser.roles.some((role) => allowedRoles.includes(role));

        if (!hasRequiredRole) {
          router.replace(getRoleHome(currentUser.roles));
          return;
        }

        setUser(currentUser);
      })
      .catch((error) => {
        if (!active) return;

        if (error instanceof AuthRequiredError) {
          router.replace("/login");
        }
      });

    return () => {
      active = false;
    };
  }, [router, allowedRolesKey]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => {
    const roles = user?.roles ?? allowedRoles ?? [];
    const unique = new Map<string, NavItem>();

    roles.forEach((role) => {
      for (const item of roleNavigation[role] ?? []) {
        if (!unique.has(item.href)) {
          unique.set(item.href, item);
        }
      }
    });

    return unique.size ? Array.from(unique.values()) : fallbackNavigation;
  }, [user, allowedRolesKey]);

  const primaryRole = user?.roles?.[0] ?? allowedRoles?.[0] ?? "";

  const roleLabel =
    roleLabels[primaryRole] ?? primaryRole.replace(/_/g, " ");

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,.14),transparent_30%),radial-gradient(circle_at_100%_15%,rgba(124,58,237,.12),transparent_28%),#f4f7fb] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
          {/* Mobile menu */}
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:hidden"
          >
            <span className="sr-only">Menu</span>

            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            aria-label={
              desktopCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() => setDesktopCollapsed((value) => !value)}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:inline-flex"
          >
            <span className="text-lg leading-none">
              {desktopCollapsed ? "›" : "‹"}
            </span>
          </button>

          {/* Brand */}
          <Link
            href={getRoleHome(user?.roles ?? allowedRoles ?? [])}
            className="flex min-w-0 items-center gap-3"
          >
            <Image
              src="/branding/acadlyx-logo.png"
              alt="ACADLYX"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-contain"
              priority
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-slate-950">
                ACADLYX
              </p>

              <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:block">
                Institutional intelligence
              </p>
            </div>
          </Link>

          {/* Page title */}
          <div className="ml-2 hidden min-w-0 flex-1 md:block">
            <p className="truncate text-sm font-semibold text-slate-900">
              {title}
            </p>

            <p className="truncate text-xs text-slate-500">
              {subtitle || "Institutional workspace"}
            </p>
          </div>

          {/* Account */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-slate-800">
                {user
                  ? `${user.firstName} ${user.lastName}`
                  : "Loading…"}
              </p>

              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {roleLabel}
              </p>
            </div>

            <AccountMenu />

            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        {/* Mobile backdrop */}
        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 top-[72px] z-30 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed bottom-0 left-0 top-[72px] z-40 w-[280px] border-r border-slate-200/80 bg-white/95 px-3 py-4 shadow-2xl backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:translate-x-0 lg:shadow-none ${
            mobileSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          } ${
            desktopCollapsed
              ? "lg:w-[82px]"
              : "lg:w-[250px]"
          }`}
        >
          <div className="mb-4 px-2">
            <p
              className={`text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 ${
                desktopCollapsed ? "lg:hidden" : ""
              }`}
            >
              Workspace
            </p>

            {!desktopCollapsed && (
              <p className="mt-1 truncate text-xs font-semibold text-slate-600 lg:block">
                {roleLabel}
              </p>
            )}
          </div>

          <nav
            className="space-y-1"
            aria-label="Dashboard navigation"
          >
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  title={
                    desktopCollapsed
                      ? item.label
                      : undefined
                  }
                  onClick={() =>
                    setMobileSidebarOpen(false)
                  }
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/15"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  } ${
                    desktopCollapsed
                      ? "lg:justify-center lg:px-2"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-white"
                    }`}
                  >
                    {item.label
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>

                  <span
                    className={
                      desktopCollapsed
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

          <div
            className={`mt-6 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-violet-50 p-4 ${
              desktopCollapsed ? "lg:hidden" : ""
            }`}
          >
            <p className="text-xs font-extrabold text-slate-900">
              ACADLYX
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              One institutional workspace for academics,
              operations and intelligence.
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function getRoleHome(roles: string[]): string {
  const priority = [
    "SUPER_ADMIN",
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "MANAGEMENT",
    "HOD",
    "FACULTY",
    "STAFF",
    "PARENT",
    "STUDENT",
  ];

  const role = priority.find((candidate) =>
    roles.includes(candidate)
  );

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

    default:
      return "/login";
  }
}
