import { AuthUser } from "./auth";

export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  roles: string[];
  permissions?: string[];
  group?: string;
};

const ROLE_PRIORITY = [
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

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Institution Admin",
  DIRECTOR: "Director",
  MANAGEMENT: "Management",
  HOD: "Head of Department",
  FACULTY: "Faculty",
  STAFF: "Staff",
  PARENT: "Parent",
  STUDENT: "Student",
  CMS: "CMS",
};

/**
 * The single frontend source of truth for workspace navigation and route
 * visibility. Backend middleware remains the final authorization boundary.
 */
const NAVIGATION: NavigationItem[] = [
  { label: "Overview", href: "/student", icon: "⌂", roles: ["STUDENT"], group: "Workspace" },
  { label: "Timetable", href: "/student/timetable", icon: "▦", roles: ["STUDENT"], permissions: ["course-offerings.read"], group: "My Academics" },
  { label: "Academic dates", href: "/student/calendar", icon: "◫", roles: ["STUDENT"], group: "My Academics" },
  { label: "Attendance", href: "/student/attendance", icon: "◷", roles: ["STUDENT"], permissions: ["attendance.read"], group: "My Academics" },
  { label: "Assignments", href: "/student/assignments", icon: "✓", roles: ["STUDENT"], permissions: ["assignments.read"], group: "My Academics" },
  { label: "Marks", href: "/student/marks", icon: "◈", roles: ["STUDENT"], permissions: ["marks.read"], group: "My Academics" },
  { label: "Results", href: "/student/results", icon: "★", roles: ["STUDENT"], permissions: ["marks.read"], group: "My Academics" },
  { label: "Examinations", href: "/student/examinations", icon: "◉", roles: ["STUDENT"], permissions: ["marks.read"], group: "My Academics" },
  { label: "Fees", href: "/student/fees", icon: "₹", roles: ["STUDENT"], group: "Services" },
  { label: "Notifications", href: "/student/notifications", icon: "◌", roles: ["STUDENT"], permissions: ["notifications.read"], group: "Services" },
  { label: "Profile", href: "/student/profile", icon: "◍", roles: ["STUDENT"], group: "Account" },

  { label: "Overview", href: "/faculty", icon: "⌂", roles: ["FACULTY"], group: "Workspace" },
  { label: "Attendance", href: "/faculty/attendance", icon: "◷", roles: ["FACULTY"], permissions: ["attendance.mark"], group: "Teaching" },
  { label: "Assignments", href: "/faculty/assignments", icon: "✓", roles: ["FACULTY"], permissions: ["assignments.read"], group: "Teaching" },
  { label: "Marks", href: "/faculty/marks", icon: "◈", roles: ["FACULTY"], permissions: ["marks.enter"], group: "Teaching" },
  { label: "Profile", href: "/faculty/profile", icon: "◍", roles: ["FACULTY"], group: "Account" },

  { label: "Overview", href: "/parent", icon: "⌂", roles: ["PARENT"], group: "Workspace" },
  { label: "Profile", href: "/parent/profile", icon: "◍", roles: ["PARENT"], group: "Account" },

  { label: "Overview", href: "/hod", icon: "⌂", roles: ["HOD"], group: "Workspace" },
  { label: "Department operations", href: "/erp", icon: "▦", roles: ["HOD"], permissions: ["attendance.read"], group: "Department" },
  { label: "Academic monitoring", href: "/intelligence", icon: "✦", roles: ["HOD"], permissions: ["intelligence.read"], group: "Department" },

  { label: "Overview", href: "/management", icon: "⌂", roles: ["MANAGEMENT", "DIRECTOR"] },
  { label: "ERP operations", href: "/erp", icon: "▦", roles: ["MANAGEMENT", "DIRECTOR"], permissions: ["attendance.read"] },
  { label: "Intelligence", href: "/intelligence", icon: "✦", roles: ["MANAGEMENT", "DIRECTOR"], permissions: ["intelligence.read"] },
  { label: "Data import", href: "/imports", icon: "⇅", roles: ["MANAGEMENT", "DIRECTOR"], permissions: ["imports.manage"] },
  { label: "Website CMS", href: "/site-content", icon: "◫", roles: ["MANAGEMENT", "DIRECTOR", "CMS"], permissions: ["site.manage"] },

  { label: "Overview", href: "/admin", icon: "⌂", roles: ["INSTITUTION_ADMIN"], group: "Workspace" },
  { label: "Academic structure", href: "/erp", icon: "▦", roles: ["INSTITUTION_ADMIN"], permissions: ["departments.read"], group: "Institution" },
  { label: "People & stakeholders", href: "/students", icon: "♙", roles: ["INSTITUTION_ADMIN"], permissions: ["students.read"], group: "People" },
  { label: "User lifecycle", href: "/user-management", icon: "♙", roles: ["INSTITUTION_ADMIN", "SUPER_ADMIN"], permissions: ["users.delete"], group: "People" },
  { label: "Announcements", href: "/notices", icon: "◌", roles: ["INSTITUTION_ADMIN"], permissions: ["notices.manage"], group: "Administration" },
  { label: "Reports", href: "/reports", icon: "▤", roles: ["INSTITUTION_ADMIN"], permissions: ["reports.read"], group: "Administration" },
  { label: "Data import", href: "/imports", icon: "⇅", roles: ["INSTITUTION_ADMIN"], permissions: ["imports.manage"], group: "Administration" },

  { label: "Overview", href: "/staff", icon: "⌂", roles: ["STAFF"] },
  { label: "ERP operations", href: "/erp", icon: "▦", roles: ["STAFF"], permissions: ["students.read"] },

  { label: "Platform overview", href: "/superadmin", icon: "⌂", roles: ["SUPER_ADMIN"], group: "Platform" },
  { label: "Institutions", href: "/superadmin/institutions", icon: "▦", roles: ["SUPER_ADMIN"], permissions: ["institutions.manage"], group: "Platform" },
  { label: "Platform stakeholders", href: "/superadmin/users", icon: "♙", roles: ["SUPER_ADMIN"], permissions: ["users.read"], group: "Platform" },
  { label: "Audit & system logs", href: "/superadmin/audit", icon: "▤", roles: ["SUPER_ADMIN"], permissions: ["audit.read"], group: "Platform" },
];

export function primaryRole(roles: readonly string[]): string {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0] || "";
}

export function workspaceHome(roles: readonly string[]): string {
  const role = primaryRole(roles);
  return {
    SUPER_ADMIN: "/superadmin",
    INSTITUTION_ADMIN: "/admin",
    DIRECTOR: "/management",
    MANAGEMENT: "/management",
    HOD: "/hod",
    FACULTY: "/faculty",
    STAFF: "/staff",
    PARENT: "/parent",
    STUDENT: "/student",
    CMS: "/site-content",
  }[role] || "/login";
}

export function canUseNavigationItem(user: AuthUser, item: NavigationItem): boolean {
  if (!item.roles.some((role) => user.roles.includes(role))) return false;
  return !item.permissions || item.permissions.every((permission) => user.permissions.includes(permission));
}

export function navigationForUser(user: AuthUser): NavigationItem[] {
  const seen = new Set<string>();
  return NAVIGATION.filter((item) => canUseNavigationItem(user, item)).filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

export function navigationGroups(items: NavigationItem[]): Array<{ label: string; items: NavigationItem[] }> {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const label = item.group || "Workspace";
    groups.set(label, [...(groups.get(label) || []), item]);
  }
  return [...groups.entries()].map(([label, groupedItems]) => ({ label, items: groupedItems }));
}

export function activeNavigationHref(pathname: string, items: NavigationItem[]): string | null {
  const matches = items.filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)));
  return matches.sort((left, right) => right.href.length - left.href.length)[0]?.href || null;
}

export function canAccessWorkspace(user: AuthUser, allowedRoles?: readonly string[]): boolean {
  return !allowedRoles?.length || allowedRoles.some((role) => user.roles.includes(role));
}

/** Route ownership guard used by the shared shell for direct URL access. */
export function canAccessRoute(user: AuthUser, pathname: string, allowedRoles?: readonly string[]): boolean {
  if (!canAccessWorkspace(user, allowedRoles)) return false;
  const namespaceOwners: Array<[string, string[]]> = [
    ["/student", ["STUDENT"]],
    ["/faculty", ["FACULTY"]],
    ["/parent", ["PARENT"]],
    ["/management", ["MANAGEMENT", "DIRECTOR"]],
    ["/hod", ["HOD"]],
    ["/admin", ["INSTITUTION_ADMIN"]],
    ["/superadmin", ["SUPER_ADMIN"]],
  ];
  const owner = namespaceOwners.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return !owner || owner[1].some((role) => user.roles.includes(role));
}
