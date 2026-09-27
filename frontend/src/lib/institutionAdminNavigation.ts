import type { AuthUser } from "@/lib/auth";

export type InstitutionAdminNavItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
  description: string;
  read: string[];
  create?: string[];
  update?: string[];
  delete?: string[];
};

export const INSTITUTION_ADMIN_NAV: readonly InstitutionAdminNavItem[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: "⌂",
    group: "Workspace",
    description: "Institution-wide administrative command center.",
    read: [],
  },

  {
    label: "Users",
    href: "/admin/users",
    icon: "♙",
    group: "People",
    description: "Manage institutional user accounts and access roles.",
    read: ["users.read"],
    create: ["users.create"],
    update: ["users.update"],
    delete: ["users.delete"],
  },

  {
    label: "Students",
    href: "/admin/students",
    icon: "◎",
    group: "People",
    description: "Manage student master records and enrolments.",
    read: ["students.read"],
    create: ["students.create"],
    update: ["students.update"],
  },

  {
    label: "Departments",
    href: "/admin/departments",
    icon: "▦",
    group: "Academic structure",
    description: "Manage departments and campus assignment.",
    read: ["departments.read"],
    create: ["departments.create"],
    update: ["departments.update"],
    delete: ["departments.delete"],
  },

  {
    label: "Programs",
    href: "/admin/programs",
    icon: "◈",
    group: "Academic structure",
    description: "Manage programs, levels, duration and ownership.",
    read: ["programs.read"],
    create: ["programs.create"],
    update: ["programs.update"],
    delete: ["programs.delete"],
  },

  {
    label: "Academic Years",
    href: "/admin/academic-years",
    icon: "◫",
    group: "Academic structure",
    description: "Manage academic-year windows and the current year.",
    read: ["academic-years.read"],
    create: ["academic-years.create"],
    update: ["academic-years.update"],
  },

  {
    label: "Semesters",
    href: "/admin/semesters",
    icon: "◒",
    group: "Academic structure",
    description: "Manage semester definitions under programs and years.",
    read: ["semesters.read"],
    create: ["semesters.create"],
    update: ["semesters.update"],
    delete: ["semesters.delete"],
  },

  {
    label: "Sections",
    href: "/admin/sections",
    icon: "⊞",
    group: "Academic structure",
    description: "Manage class sections and capacity.",
    read: ["sections.read"],
    create: ["sections.create"],
    update: ["sections.update"],
    delete: ["sections.delete"],
  },

  {
    label: "Courses",
    href: "/admin/courses",
    icon: "▤",
    group: "Academic structure",
    description: "Manage the institution course catalogue.",
    read: ["courses.read"],
    create: ["courses.create"],
    update: ["courses.update"],
    delete: ["courses.delete"],
  },

  {
    label: "Course Offerings",
    href: "/admin/course-offerings",
    icon: "◇",
    group: "Academic structure",
    description: "Assign courses to semesters, sections and faculty.",
    read: ["course-offerings.read"],
    create: ["course-offerings.create"],
    update: ["course-offerings.update"],
    delete: ["course-offerings.delete"],
  },

  {
    label: "Campuses",
    href: "/admin/campuses",
    icon: "⌂",
    group: "Institution",
    description: "Manage institution campuses and addresses.",
    read: ["campuses.read"],
    create: ["campuses.create"],
    update: ["campuses.update"],
    delete: ["campuses.delete"],
  },

  {
    label: "Notices",
    href: "/admin/notices",
    icon: "◌",
    group: "Institution",
    description: "Publish, edit and remove institution notices.",
    read: ["notices.read"],
    create: ["notices.manage"],
    update: ["notices.manage"],
    delete: ["notices.manage"],
  },

  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: "◉",
    group: "Institution",
    description: "Send targeted portal notifications to institutional users.",
    read: ["notifications.read"],
    create: ["notices.manage"],
  },

  {
    label: "Documents",
    href: "/admin/documents",
    icon: "▱",
    group: "Institution",
    description: "Manage student-facing document records.",
    read: ["documents.read"],
    create: ["students.update"],
    delete: ["students.update"],
  },

  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: "◫",
    group: "Institution",
    description: "Create and maintain institutional calendar events.",
    read: ["calendar.read"],
    create: ["calendar.manage"],
    update: ["calendar.manage"],
    delete: ["calendar.manage"],
  },

  {
    label: "Parent Links",
    href: "/admin/parent-links",
    icon: "♧",
    group: "Institution",
    description: "Connect parent accounts with student records.",
    read: ["parent-links.read"],
    create: ["parent-links.manage"],
    delete: ["parent-links.manage"],
  },

  {
    label: "Operations",
    href: "/admin/operations",
    icon: "⚙",
    group: "Institution",
    description: "Manage facilities, assets and operational requests.",
    read: ["operations.read"],
    create: ["operations.manage", "maintenance.raise"],
    update: ["operations.manage", "maintenance.raise"],
  },
];

export function hasAny(
  user: AuthUser | null,
  permissions: string[],
): boolean {
  if (!permissions.length) {
    return true;
  }

  return permissions.some((permission) =>
    user?.permissions.includes(permission),
  );
}

export function canSee(
  user: AuthUser | null,
  item: InstitutionAdminNavItem,
): boolean {
  if (!user?.roles.includes("INSTITUTION_ADMIN")) {
    return false;
  }

  return Boolean(
    hasAny(user, item.read) ||
      hasAny(user, item.create ?? []) ||
      hasAny(user, item.update ?? []) ||
      hasAny(user, item.delete ?? []),
  );
}

export function getInstitutionAdminNavigation(
  user: AuthUser | null,
): InstitutionAdminNavItem[] {
  return INSTITUTION_ADMIN_NAV.filter((item) => canSee(user, item));
}

export function findInstitutionAdminNavItem(
  pathname: string,
): InstitutionAdminNavItem | null {
  return (
    INSTITUTION_ADMIN_NAV
      .filter(
        (item) =>
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  );
}

export function canAccessInstitutionAdminPath(
  user: AuthUser | null,
  pathname: string,
): boolean {
  if (!user?.roles.includes("INSTITUTION_ADMIN")) {
    return false;
  }

  if (pathname === "/admin") {
    return true;
  }

  const item = findInstitutionAdminNavItem(pathname);

  return Boolean(item && canSee(user, item));
}
