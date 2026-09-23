import type { AuthUser } from "./auth";

/**
 * ACADLYX — Workspace Navigation
 *
 * PRINCIPLE:
 *
 * Role -> Permission -> Module -> Route
 *
 * This file controls FRONTEND visibility only.
 * Backend authorization remains the final security boundary.
 *
 * IMPORTANT:
 * A higher organizational role does not automatically inherit
 * every operational workspace.
 *
 * Example:
 *   INSTITUTION_ADMIN != ACCOUNTS
 *   DIRECTOR != EXAMINATION OPERATOR
 *   HOD != FACULTY
 *   SUPER_ADMIN != institutional operator
 */

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
] as const;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Institution Admin",
  CHAIRMAN: "Chairman",
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
  PLACEMENT: "Placement Cell",
  IT: "IT",
  CMS: "Website CMS",
  STUDENT: "Student",
  PARENT: "Parent",
  CLUB_PRESIDENT: "Club President",
};

const ROLE_ALIASES: Record<string, string> = {
  MANAGEMENT: "CHAIRMAN",
  STAFF: "ACCOUNTS",
};

function normalizeRole(role: string): string {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();

  return ROLE_ALIASES[normalized] || normalized;
}

function hasRole(
  user: AuthUser,
  role: string,
): boolean {
  const expected = normalizeRole(role);

  return user.roles.some(
    (userRole) =>
      normalizeRole(userRole) === expected,
  );
}

function hasAnyRole(
  user: AuthUser,
  roles: readonly string[],
): boolean {
  return roles.some((role) =>
    hasRole(user, role),
  );
}

function hasAllPermissions(
  user: AuthUser,
  permissions: readonly string[],
): boolean {
  if (!permissions.length) {
    return true;
  }

  const granted = new Set(
    Array.isArray(user.permissions)
      ? user.permissions
      : [],
  );

  return permissions.every((permission) =>
    granted.has(permission),
  );
}

/**
 * Navigation catalogue.
 *
 * Do NOT add a module here merely because a route exists.
 *
 * Add it only when the role has a legitimate workspace responsibility
 * and the permission model supports the visibility.
 */
const NAVIGATION: NavigationItem[] = [
  /* ====================================================================== */
  /* SUPER ADMIN — PLATFORM ONLY                                           */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/superadmin",
    icon: "⌂",
    roles: ["SUPER_ADMIN"],
    group: "Platform",
  },

  {
    label: "Institutions",
    href: "/superadmin/institutions",
    icon: "▦",
    roles: ["SUPER_ADMIN"],
    permissions: ["institutions.manage"],
    group: "Platform",
  },

  {
    label: "Platform users",
    href: "/superadmin/users",
    icon: "♙",
    roles: ["SUPER_ADMIN"],
    permissions: ["users.read"],
    group: "Platform",
  },

  {
    label: "Platform audit",
    href: "/superadmin/audit",
    icon: "▤",
    roles: ["SUPER_ADMIN"],
    permissions: ["audit.read"],
    group: "Platform",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["SUPER_ADMIN"],
    group: "Account",
  },

  /* ====================================================================== */
  /* INSTITUTION ADMIN — ADMINISTRATION ONLY                               */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/admin",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    group: "Administration",
  },

  {
    label: "People",
    href: "/user-management",
    icon: "♙",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["users.read"],
    group: "People",
  },

  {
    label: "Academic structure",
    href: "/admin",
    icon: "▦",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["departments.read"],
    group: "Institution",
  },

  {
    label: "Campuses",
    href: "/admin",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["campuses.read"],
    group: "Institution",
  },

  {
    label: "Timetable",
    href: "/timetable",
    icon: "◷",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["timetable.read"],
    group: "Institution",
  },

  {
    label: "Notices",
    href: "/notices",
    icon: "◌",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["notices.read"],
    group: "Institution",
  },

  {
    label: "Calendar",
    href: "/calendar",
    icon: "◫",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["calendar.read"],
    group: "Institution",
  },

  {
    label: "Notifications",
    href: "/notifications",
    icon: "◉",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["notifications.read"],
    group: "Institution",
  },

  {
    label: "Operations",
    href: "/operations",
    icon: "⚙",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["operations.read"],
    group: "Institution",
  },

  {
    label: "Admissions overview",
    href: "/admissions",
    icon: "↗",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["admissions.read"],
    group: "Oversight",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },

  {
    label: "Course registration",
    href: "/course-registration",
    icon: "✓",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["registration.read"],
    group: "Oversight",
  },

  {
    label: "Student movement",
    href: "/student-promotion",
    icon: "↑",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["promotions.read"],
    group: "Oversight",
  },

  {
    label: "Certificates",
    href: "/certificates",
    icon: "▣",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["certificates.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["INSTITUTION_ADMIN"],
    group: "Account",
  },

  /* ====================================================================== */
  /* MANAGEMENT / CHAIRMAN                                                 */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/chairman",
    icon: "⌂",
    roles: ["CHAIRMAN"],
    group: "Workspace",
  },

  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["CHAIRMAN"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["CHAIRMAN"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Financial oversight",
    href: "/fees",
    icon: "₹",
    roles: ["CHAIRMAN"],
    permissions: ["fees.read"],
    group: "Oversight",
  },

  {
    label: "Academic oversight",
    href: "/examinations",
    icon: "◉",
    roles: ["CHAIRMAN"],
    permissions: ["exams.read"],
    group: "Oversight",
  },

  {
    label: "Operations oversight",
    href: "/operations",
    icon: "⚙",
    roles: ["CHAIRMAN"],
    permissions: ["operations.read"],
    group: "Oversight",
  },

  {
    label: "Audit",
    href: "/reports",
    icon: "▤",
    roles: ["CHAIRMAN"],
    permissions: ["audit.read"],
    group: "Governance",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["CHAIRMAN"],
    group: "Account",
  },

  /* ====================================================================== */
  /* DIRECTOR                                                               */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/director",
    icon: "⌂",
    roles: ["DIRECTOR"],
    group: "Workspace",
  },

  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["DIRECTOR"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["DIRECTOR"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Approvals",
    href: "/student-promotion",
    icon: "✓",
    roles: ["DIRECTOR"],
    permissions: ["promotions.approve"],
    group: "Approvals",
  },

  {
    label: "Examination oversight",
    href: "/examinations",
    icon: "◉",
    roles: ["DIRECTOR"],
    permissions: ["exams.read"],
    group: "Oversight",
  },

  {
    label: "Financial oversight",
    href: "/fees",
    icon: "₹",
    roles: ["DIRECTOR"],
    permissions: ["fees.read"],
    group: "Oversight",
  },

  {
    label: "Attendance governance",
    href: "/reports",
    icon: "◷",
    roles: ["DIRECTOR"],
    permissions: ["attendance.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["DIRECTOR"],
    group: "Account",
  },

  /* ====================================================================== */
  /* DEAN                                                                   */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/dean",
    icon: "⌂",
    roles: ["DEAN"],
    group: "Workspace",
  },

  {
    label: "Academic intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["DEAN"],
    permissions: ["intelligence.read"],
    group: "Academic",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["DEAN"],
    permissions: ["reports.read"],
    group: "Academic",
  },

  {
    label: "Students",
    href: "/students",
    icon: "♙",
    roles: ["DEAN"],
    permissions: ["students.read"],
    group: "Academic",
  },

  {
    label: "Attendance oversight",
    href: "/reports",
    icon: "◷",
    roles: ["DEAN"],
    permissions: ["attendance.read"],
    group: "Academic",
  },

  {
    label: "Results oversight",
    href: "/results",
    icon: "◉",
    roles: ["DEAN"],
    permissions: ["results.read"],
    group: "Academic",
  },

  {
    label: "Examinations",
    href: "/examinations",
    icon: "✍",
    roles: ["DEAN"],
    permissions: ["exams.read"],
    group: "Academic",
  },

  {
    label: "Course registration",
    href: "/course-registration",
    icon: "✓",
    roles: ["DEAN"],
    permissions: ["registration.read"],
    group: "Academic",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["DEAN"],
    group: "Account",
  },

  /* ====================================================================== */
  /* REGISTRAR                                                              */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/registrar",
    icon: "⌂",
    roles: ["REGISTRAR"],
    group: "Workspace",
  },

  {
    label: "Students",
    href: "/students",
    icon: "♙",
    roles: ["REGISTRAR"],
    permissions: ["students.read"],
    group: "Records",
  },

  {
    label: "Academic structure",
    href: "/enrollment",
    icon: "▦",
    roles: ["REGISTRAR"],
    permissions: ["departments.read"],
    group: "Records",
  },

  {
    label: "Course registration",
    href: "/course-registration",
    icon: "✓",
    roles: ["REGISTRAR"],
    permissions: ["registration.read"],
    group: "Records",
  },

  {
    label: "Student movement",
    href: "/student-promotion",
    icon: "↑",
    roles: ["REGISTRAR"],
    permissions: ["promotions.read"],
    group: "Records",
  },

  {
    label: "Certificates",
    href: "/certificates",
    icon: "▣",
    roles: ["REGISTRAR"],
    permissions: ["certificates.read"],
    group: "Records",
  },

  {
    label: "Results",
    href: "/results",
    icon: "◉",
    roles: ["REGISTRAR"],
    permissions: ["results.read"],
    group: "Academic records",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["REGISTRAR"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["REGISTRAR"],
    group: "Account",
  },

  /* ====================================================================== */
  /* HOD                                                                    */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/hod",
    icon: "⌂",
    roles: ["HOD"],
    group: "Workspace",
  },

  {
    label: "Department students",
    href: "/students",
    icon: "♙",
    roles: ["HOD"],
    permissions: ["students.read"],
    group: "Department",
  },

  {
    label: "Faculty & teaching",
    href: "/faculty-management",
    icon: "♙",
    roles: ["HOD"],
    permissions: ["users.read"],
    group: "Department",
  },

  {
    label: "Attendance",
    href: "/erp",
    icon: "◷",
    roles: ["HOD"],
    permissions: ["attendance.read"],
    group: "Department",
  },

  {
    label: "Assignments",
    href: "/faculty/assignments",
    icon: "✓",
    roles: ["HOD"],
    permissions: ["assignments.read"],
    group: "Academic",
  },

  {
    label: "Marks",
    href: "/results",
    icon: "◈",
    roles: ["HOD"],
    permissions: ["marks.read"],
    group: "Academic",
  },

  {
    label: "Examinations",
    href: "/examinations",
    icon: "✍",
    roles: ["HOD"],
    permissions: ["exams.read"],
    group: "Academic",
  },

  {
    label: "Results",
    href: "/results",
    icon: "◉",
    roles: ["HOD"],
    permissions: ["results.read"],
    group: "Academic",
  },

  {
    label: "Timetable",
    href: "/timetable",
    icon: "◷",
    roles: ["HOD"],
    permissions: ["timetable.read"],
    group: "Department",
  },

  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["HOD"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["HOD"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["HOD"],
    group: "Account",
  },

  /* ====================================================================== */
  /* FACULTY                                                                */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/faculty",
    icon: "⌂",
    roles: ["FACULTY"],
    group: "Teaching",
  },

  {
    label: "My timetable",
    href: "/timetable",
    icon: "◷",
    roles: ["FACULTY"],
    permissions: ["timetable.read"],
    group: "Teaching",
  },

  {
    label: "Attendance",
    href: "/faculty/attendance",
    icon: "◷",
    roles: ["FACULTY"],
    permissions: ["attendance.read"],
    group: "Teaching",
  },

  {
    label: "Assignments",
    href: "/faculty/assignments",
    icon: "✓",
    roles: ["FACULTY"],
    permissions: ["assignments.read"],
    group: "Teaching",
  },

  {
    label: "Marks",
    href: "/faculty/marks",
    icon: "◈",
    roles: ["FACULTY"],
    permissions: ["marks.read"],
    group: "Teaching",
  },

  {
    label: "Examination duties",
    href: "/examinations",
    icon: "✍",
    roles: ["FACULTY"],
    permissions: ["exams.invigilate"],
    group: "Teaching",
  },

  {
    label: "LMS",
    href: "/lms",
    icon: "▦",
    roles: ["FACULTY"],
    permissions: ["lms.read"],
    group: "Teaching",
  },

  {
    label: "Leave",
    href: "/leave-management",
    icon: "◌",
    roles: ["FACULTY"],
    permissions: ["leave.apply"],
    group: "Services",
  },

  {
    label: "Calendar",
    href: "/calendar",
    icon: "◫",
    roles: ["FACULTY"],
    permissions: ["calendar.read"],
    group: "Services",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["FACULTY"],
    group: "Account",
  },

  /* ====================================================================== */
  /* ACCOUNTS                                                               */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/accounts",
    icon: "⌂",
    roles: ["ACCOUNTS"],
    group: "Finance",
  },

  {
    label: "Fees",
    href: "/fees",
    icon: "₹",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Finance",
  },

  {
    label: "Receipts",
    href: "/fees/receipts",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.pay"],
    group: "Finance",
  },

  {
    label: "Financial reports",
    href: "/reports",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["reports.read"],
    group: "Finance",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["ACCOUNTS"],
    group: "Account",
  },

  /* ====================================================================== */
  /* HR                                                                     */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/hr",
    icon: "⌂",
    roles: ["HR"],
    group: "People",
  },

  {
    label: "Employees",
    href: "/staff",
    icon: "♙",
    roles: ["HR"],
    permissions: ["hr.read"],
    group: "People",
  },

  {
    label: "Leave",
    href: "/leave-management",
    icon: "◌",
    roles: ["HR"],
    permissions: ["leave.read"],
    group: "People",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["HR"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["HR"],
    group: "Account",
  },

  /* ====================================================================== */
  /* ADMISSIONS                                                             */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/admissions",
    icon: "⌂",
    roles: ["ADMISSIONS"],
    group: "Admissions",
  },

  {
    label: "Applications",
    href: "/applications",
    icon: "↗",
    roles: ["ADMISSIONS"],
    permissions: ["admissions.manage"],
    group: "Admissions",
  },

  {
    label: "Documents",
    href: "/forms",
    icon: "▤",
    roles: ["ADMISSIONS"],
    permissions: ["documents.read"],
    group: "Admissions",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["ADMISSIONS"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["ADMISSIONS"],
    group: "Account",
  },

  /* ====================================================================== */
  /* EXAMINATION                                                            */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/examinations",
    icon: "⌂",
    roles: ["EXAMINATION"],
    group: "Examination",
  },

  {
    label: "Examinations",
    href: "/examinations",
    icon: "✍",
    roles: ["EXAMINATION"],
    permissions: ["exams.read"],
    group: "Examination",
  },

  {
    label: "Results",
    href: "/results",
    icon: "◉",
    roles: ["EXAMINATION"],
    permissions: ["results.read"],
    group: "Examination",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["EXAMINATION"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Audit",
    href: "/reports",
    icon: "▤",
    roles: ["EXAMINATION"],
    permissions: ["audit.read"],
    group: "Governance",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["EXAMINATION"],
    group: "Account",
  },

  /* ====================================================================== */
  /* LIBRARY                                                                */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/library",
    icon: "⌂",
    roles: ["LIBRARIAN"],
    group: "Library",
  },

  {
    label: "Catalogue & circulation",
    href: "/library",
    icon: "▤",
    roles: ["LIBRARIAN"],
    permissions: ["library.manage"],
    group: "Library",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["LIBRARIAN"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["LIBRARIAN"],
    group: "Account",
  },

  /* ====================================================================== */
  /* PLACEMENT                                                              */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/placements",
    icon: "⌂",
    roles: ["PLACEMENT"],
    group: "Placement",
  },

  {
    label: "Placement operations",
    href: "/placements",
    icon: "♙",
    roles: ["PLACEMENT"],
    group: "Placement",
  },

  {
    label: "Students",
    href: "/students",
    icon: "♙",
    roles: ["PLACEMENT"],
    permissions: ["students.read"],
    group: "Placement",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["PLACEMENT"],
    permissions: ["reports.read"],
    group: "Oversight",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["PLACEMENT"],
    group: "Account",
  },

  /* ====================================================================== */
  /* IT                                                                     */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/it",
    icon: "⌂",
    roles: ["IT"],
    group: "Technology",
  },

  {
    label: "Operations",
    href: "/operations",
    icon: "⚙",
    roles: ["IT"],
    permissions: ["operations.read"],
    group: "Technology",
  },

  {
    label: "Users",
    href: "/user-management",
    icon: "♙",
    roles: ["IT"],
    permissions: ["users.read"],
    group: "Technology",
  },

  {
    label: "Audit",
    href: "/reports",
    icon: "▤",
    roles: ["IT"],
    permissions: ["audit.read"],
    group: "Governance",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["IT"],
    group: "Account",
  },

  /* ====================================================================== */
  /* CMS                                                                    */
  /* ====================================================================== */

  {
    label: "Website",
    href: "/site-content",
    icon: "◫",
    roles: ["CMS"],
    permissions: ["site.manage"],
    group: "Website",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["CMS"],
    group: "Account",
  },

  /* ====================================================================== */
  /* STUDENT                                                                */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/student",
    icon: "⌂",
    roles: ["STUDENT"],
    group: "My workspace",
  },

  {
    label: "Timetable",
    href: "/student/timetable",
    icon: "▦",
    roles: ["STUDENT"],
    permissions: ["timetable.read"],
    group: "Academics",
  },

  {
    label: "Attendance",
    href: "/student/attendance",
    icon: "◷",
    roles: ["STUDENT"],
    permissions: ["attendance.read"],
    group: "Academics",
  },

  {
    label: "Assignments",
    href: "/student/assignments",
    icon: "✓",
    roles: ["STUDENT"],
    permissions: ["assignments.read"],
    group: "Academics",
  },

  {
    label: "Marks",
    href: "/student/marks",
    icon: "◈",
    roles: ["STUDENT"],
    permissions: ["marks.read"],
    group: "Academics",
  },

  {
    label: "Results",
    href: "/student/results",
    icon: "★",
    roles: ["STUDENT"],
    permissions: ["results.read"],
    group: "Academics",
  },

  {
    label: "Examinations",
    href: "/student/examinations",
    icon: "◉",
    roles: ["STUDENT"],
    permissions: ["exams.read"],
    group: "Academics",
  },

  {
    label: "Course registration",
    href: "/student/course-registration",
    icon: "✓",
    roles: ["STUDENT"],
    permissions: ["registration.submit"],
    group: "Student services",
  },

  {
    label: "Fees",
    href: "/student/fees",
    icon: "₹",
    roles: ["STUDENT"],
    permissions: ["fees.read"],
    group: "Student services",
  },

  {
    label: "Library",
    href: "/student/library",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["library.read"],
    group: "Student services",
  },

  {
    label: "Certificates",
    href: "/student/certificates",
    icon: "▣",
    roles: ["STUDENT"],
    permissions: ["certificates.request"],
    group: "Student services",
  },

  {
    label: "Leave",
    href: "/student/leave",
    icon: "◌",
    roles: ["STUDENT"],
    permissions: ["leave.apply"],
    group: "Student services",
  },

  {
    label: "Calendar",
    href: "/student/calendar",
    icon: "◫",
    roles: ["STUDENT"],
    permissions: ["calendar.read"],
    group: "Student services",
  },

  {
    label: "Profile",
    href: "/student/profile",
    icon: "◍",
    roles: ["STUDENT"],
    group: "Account",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["STUDENT"],
    group: "Account",
  },

  /* ====================================================================== */
  /* PARENT                                                                 */
  /* ====================================================================== */

  {
    label: "Overview",
    href: "/parent",
    icon: "⌂",
    roles: ["PARENT"],
    group: "Family",
  },

  {
    label: "Children",
    href: "/parent/children",
    icon: "♧",
    roles: ["PARENT"],
    permissions: ["parent-portal.read"],
    group: "Family",
  },

  {
    label: "Academic progress",
    href: "/parent/students",
    icon: "◈",
    roles: ["PARENT"],
    permissions: ["parent-portal.read"],
    group: "Family",
  },

  {
    label: "Profile",
    href: "/parent/profile",
    icon: "◍",
    roles: ["PARENT"],
    group: "Account",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["PARENT"],
    group: "Account",
  },

  /* ====================================================================== */
  /* CLUB PRESIDENT                                                         */
  /* ====================================================================== */

  {
    label: "Club workspace",
    href: "/club-president",
    icon: "⌂",
    roles: ["CLUB_PRESIDENT"],
    permissions: ["club.read"],
    group: "Club",
  },

  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["CLUB_PRESIDENT"],
    group: "Account",
  },
];

/* -------------------------------------------------------------------------- */
/* Workspace home                                                             */
/* -------------------------------------------------------------------------- */

export function primaryRole(
  roles: readonly string[],
): string {
  const normalized = roles.map(normalizeRole);

  return (
    ROLE_PRIORITY.find((role) =>
      normalized.includes(role),
    ) ||
    normalized[0] ||
    ""
  );
}

export function workspaceHome(
  roles: readonly string[],
): string {
  const role = primaryRole(roles);

  const homes: Record<string, string> = {
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

  return homes[role] || "/login";
}

/* -------------------------------------------------------------------------- */
/* Permission-aware navigation                                                */
/* -------------------------------------------------------------------------- */

export function canUseNavigationItem(
  user: AuthUser,
  item: NavigationItem,
): boolean {
  if (!hasAnyRole(user, item.roles)) {
    return false;
  }

  return hasAllPermissions(
    user,
    item.permissions || [],
  );
}

export function navigationForUser(
  user: AuthUser,
): NavigationItem[] {
  const seen = new Set<string>();

  return NAVIGATION
    .filter((item) =>
      canUseNavigationItem(user, item),
    )
    .filter((item) => {
      /*
       * Keep one sidebar entry per route.
       *
       * A role may have several permission paths to the same route,
       * but the user should not see duplicate navigation items.
       */
      if (seen.has(item.href)) {
        return false;
      }

      seen.add(item.href);
      return true;
    });
}

export function navigationGroups(
  items: NavigationItem[],
): {
  label: string;
  items: NavigationItem[];
}[] {
  const groups = new Map<
    string,
    NavigationItem[]
  >();

  for (const item of items) {
    const group = item.group || "Workspace";

    groups.set(group, [
      ...(groups.get(group) || []),
      item,
    ]);
  }

  return [...groups.entries()].map(
    ([label, groupedItems]) => ({
      label,
      items: groupedItems,
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Active route                                                               */
/* -------------------------------------------------------------------------- */

export function activeNavigationHref(
  pathname: string,
  items: NavigationItem[],
): string | null {
  return (
    items
      .filter(
        (item) =>
          pathname === item.href ||
          (
            item.href !== "/" &&
            pathname.startsWith(
              `${item.href}/`,
            )
          ),
      )
      .sort(
        (left, right) =>
          right.href.length -
          left.href.length,
      )[0]?.href || null
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace access                                                           */
/* -------------------------------------------------------------------------- */

export function canAccessWorkspace(
  user: AuthUser,
  allowedRoles?: readonly string[],
): boolean {
  if (!allowedRoles?.length) {
    return true;
  }

  return hasAnyRole(
    user,
    allowedRoles,
  );
}

/**
 * Route ownership is deliberately strict for role workspaces.
 *
 * Specialist namespaces are never exposed to another role simply because
 * the role happens to have a broad read permission.
 *
 * Example:
 *
 *   DIRECTOR may have exams.read
 *   but does not become EXAMINATION workspace owner.
 *
 * That distinction is important.
 */
const NAMESPACE_OWNERS: Array<
  [string, string[]]
> = [
  ["/superadmin", ["SUPER_ADMIN"]],

  ["/admin", ["INSTITUTION_ADMIN"]],

  ["/student", ["STUDENT"]],

  ["/faculty", ["FACULTY"]],

  ["/parent", ["PARENT"]],

  ["/chairman", ["CHAIRMAN"]],

  ["/director", ["DIRECTOR"]],

  ["/management", ["CHAIRMAN", "DIRECTOR"]],

  ["/dean", ["DEAN"]],

  ["/registrar", ["REGISTRAR"]],

  ["/hod", ["HOD"]],

  ["/accounts", ["ACCOUNTS"]],

  ["/hr", ["HR"]],

  ["/admissions", ["ADMISSIONS", "INSTITUTION_ADMIN"]],

  ["/examinations", [
    "EXAMINATION",
    "FACULTY",
    "HOD",
    "DEAN",
    "DIRECTOR",
    "CHAIRMAN",
  ]],

  ["/library", ["LIBRARIAN", "STUDENT", "FACULTY", "HOD"]],

  ["/placements", ["PLACEMENT", "STUDENT"]],

  ["/it", ["IT"]],

  ["/site-content", ["CMS"]],

  ["/club-president", ["CLUB_PRESIDENT"]],
];

/**
 * Routes that are shared institutional services.
 *
 * These still require permission checks where applicable through
 * navigationForUser(), but they aren't owned by one specialist workspace.
 */
const SHARED_ROUTES = [
  "/account-security",
  "/calendar",
  "/notices",
  "/notifications",
  "/reports",
  "/intelligence",
  "/timetable",
  "/operations",
  "/course-registration",
  "/student-promotion",
  "/certificates",
  "/results",
  "/fees",
  "/fees/receipts",
  "/lms",
  "/leave-management",
  "/faculty-management",
  "/user-management",
  "/students",
  "/staff",
  "/enrollment",
  "/applications",
  "/forms",
];

function routeMatches(
  pathname: string,
  route: string,
): boolean {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function getNamespaceOwner(
  pathname: string,
): string[] | null {
  for (const [prefix, roles] of NAMESPACE_OWNERS) {
    if (routeMatches(pathname, prefix)) {
      return roles;
    }
  }

  return null;
}

function userHasRouteNavigation(
  user: AuthUser,
  pathname: string,
): boolean {
  return navigationForUser(user).some(
    (item) =>
      routeMatches(pathname, item.href),
  );
}

/**
 * Final frontend route gate.
 *
 * This does NOT replace backend authorization.
 */
export function canAccessRoute(
  user: AuthUser,
  pathname: string,
  allowedRoles?: readonly string[],
): boolean {
  if (
    !canAccessWorkspace(
      user,
      allowedRoles,
    )
  ) {
    return false;
  }

  const namespaceOwner =
    getNamespaceOwner(pathname);

  if (namespaceOwner) {
    if (!hasAnyRole(user, namespaceOwner)) {
      return false;
    }
  }

  /*
   * Account security is available to every authenticated user.
   */
  if (routeMatches(pathname, "/account-security")) {
    return true;
  }

  /*
   * If the route is represented in the user's permission-aware
   * navigation, it is an allowed workspace destination.
   */
  if (userHasRouteNavigation(user, pathname)) {
    return true;
  }

  /*
   * Shared routes may be reachable from a role workspace when the
   * corresponding permission exists, even if they aren't primary
   * navigation entries.
   */
  if (
    SHARED_ROUTES.some((route) =>
      routeMatches(pathname, route),
    )
  ) {
    /*
     * These routes are deliberately conservative.
     *
     * If the user cannot see a corresponding navigation item,
     * do not expose the route merely because it is shared.
     */
    return false;
  }

  /*
   * Unknown routes are denied rather than optimistically allowed.
   */
  return false;
}
