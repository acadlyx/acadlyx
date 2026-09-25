import type { AuthUser } from "./auth";
import {
  hasAnyRole,
  hasAllPermissions,
  normalizeRole,
  type CanonicalRole,
} from "./authorization";

/**
 * ACADLYX — SINGLE FRONTEND NAVIGATION + ROUTE AUTHORITY REGISTRY
 *
 * This is the ONLY frontend source of truth for:
 *
 * role
 *   ↓
 * permission
 *   ↓
 * module
 *   ↓
 * route
 *
 * Backend authorization remains authoritative.
 *
 * Do not create another navigation table or route-guard table.
 */

export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  roles: readonly CanonicalRole[];
  permissions?: readonly string[];
  group: string;
  description?: string;
};

const ROLE_PRIORITY: readonly CanonicalRole[] = [
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

function item(
  label: string,
  href: string,
  icon: string,
  roles: readonly CanonicalRole[],
  group: string,
  permissions?: readonly string[],
  description?: string,
): NavigationItem {
  return {
    label,
    href,
    icon,
    roles,
    group,
    permissions,
    description,
  };
}

/**
 * CANONICAL NAVIGATION REGISTRY
 *
 * A route must be represented here before it becomes a normal
 * dashboard destination.
 */
export const NAVIGATION: readonly NavigationItem[] = [
  /*
   * ========================================================================
   * SUPER ADMIN
   * ========================================================================
   */

  item(
    "Overview",
    "/superadmin",
    "home",
    ["SUPER_ADMIN"],
    "Platform",
  ),

  item(
    "Institutions",
    "/superadmin/institutions",
    "building",
    ["SUPER_ADMIN"],
    "Platform",
    ["institutions.manage"],
  ),

  item(
    "Platform users",
    "/superadmin/users",
    "people",
    ["SUPER_ADMIN"],
    "Platform",
    ["users.read"],
  ),

  item(
    "Platform audit",
    "/superadmin/audit",
    "audit",
    ["SUPER_ADMIN"],
    "Platform",
    ["audit.read"],
  ),

  /*
   * ========================================================================
   * INSTITUTION ADMIN
   * ========================================================================
   */

  item(
    "Overview",
    "/admin",
    "home",
    ["INSTITUTION_ADMIN"],
    "Workspace",
  ),

  item(
    "People",
    "/user-management",
    "people",
    ["INSTITUTION_ADMIN"],
    "Administration",
    ["users.read"],
    "Institution people and account administration.",
  ),

  item(
    "Students",
    "/students",
    "people",
    ["INSTITUTION_ADMIN"],
    "Administration",
    ["students.read"],
    "Student directory and student records.",
  ),

  item(
    "Academic structure",
    "/admin",
    "academic",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["departments.read"],
    "Departments, programs and academic structure.",
  ),

  item(
    "Campuses",
    "/admin",
    "building",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["campuses.read"],
    "Institution campus administration.",
  ),

  item(
    "Timetable",
    "/timetable",
    "calendar",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["timetable.read"],
  ),

  item(
    "Notices",
    "/notices",
    "notice",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["notices.read"],
  ),

  item(
    "Calendar",
    "/calendar",
    "calendar",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["calendar.read"],
  ),

  item(
    "Notifications",
    "/notifications",
    "bell",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["notifications.read"],
  ),

  item(
    "Operations",
    "/operations",
    "settings",
    ["INSTITUTION_ADMIN"],
    "Institution",
    ["operations.read"],
  ),

  item(
    "Admissions",
    "/admissions",
    "admissions",
    ["INSTITUTION_ADMIN"],
    "Oversight",
    ["admissions.read"],
  ),

  item(
    "Reports",
    "/reports",
    "reports",
    ["INSTITUTION_ADMIN"],
    "Oversight",
    ["reports.read"],
  ),

  item(
    "Intelligence",
    "/intelligence",
    "intelligence",
    ["INSTITUTION_ADMIN"],
    "Oversight",
    ["intelligence.read"],
  ),

  item(
    "Course registration",
    "/course-registration",
    "registration",
    ["INSTITUTION_ADMIN"],
    "Oversight",
    ["registration.read"],
  ),

  item(
    "Student movement",
    "/student-promotion",
    "movement",
    ["INSTITUTION_ADMIN"],
    "Oversight",
    ["promotions.read"],
  ),

  item(
    "Certificates",
    "/certificates",
    "certificate",
    ["INSTITUTION_ADMIN"],
    "Oversight",
    ["certificates.read"],
  ),

  /*
   * ========================================================================
   * CHAIRMAN
   * ========================================================================
   */

  item(
    "Overview",
    "/chairman",
    "home",
    ["CHAIRMAN"],
    "Workspace",
  ),

  item(
    "Intelligence",
    "/intelligence",
    "intelligence",
    ["CHAIRMAN"],
    "Oversight",
    ["intelligence.read"],
  ),

  item(
    "Reports",
    "/reports",
    "reports",
    ["CHAIRMAN"],
    "Oversight",
    ["reports.read"],
  ),

  item(
    "Financial oversight",
    "/fees",
    "finance",
    ["CHAIRMAN"],
    "Oversight",
    ["fees.read"],
  ),

  item(
    "Academic oversight",
    "/examinations",
    "exam",
    ["CHAIRMAN"],
    "Oversight",
    ["exams.read"],
  ),

  item(
    "Operations oversight",
    "/operations",
    "settings",
    ["CHAIRMAN"],
    "Oversight",
    ["operations.read"],
  ),

  /*
   * ========================================================================
   * DIRECTOR
   * ========================================================================
   */

  item(
    "Overview",
    "/director",
    "home",
    ["DIRECTOR"],
    "Workspace",
  ),

  item(
    "Intelligence",
    "/intelligence",
    "intelligence",
    ["DIRECTOR"],
    "Oversight",
    ["intelligence.read"],
  ),

  item(
    "Reports",
    "/reports",
    "reports",
    ["DIRECTOR"],
    "Oversight",
    ["reports.read"],
  ),

  item(
    "Approvals",
    "/student-promotion",
    "approval",
    ["DIRECTOR"],
    "Approvals",
    ["promotions.approve"],
  ),

  item(
    "Examination oversight",
    "/examinations",
    "exam",
    ["DIRECTOR"],
    "Oversight",
    ["exams.read"],
  ),

  item(
    "Financial oversight",
    "/fees",
    "finance",
    ["DIRECTOR"],
    "Oversight",
    ["fees.read"],
  ),

  /*
   * ========================================================================
   * DEAN
   * ========================================================================
   */

  item(
    "Overview",
    "/dean",
    "home",
    ["DEAN"],
    "Workspace",
  ),

  item(
    "Intelligence",
    "/intelligence",
    "intelligence",
    ["DEAN"],
    "Academic",
    ["intelligence.read"],
  ),

  item(
    "Examinations",
    "/examinations",
    "exam",
    ["DEAN"],
    "Academic",
    ["exams.read"],
  ),

  item(
    "Results",
    "/results",
    "results",
    ["DEAN"],
    "Academic",
    ["results.read"],
  ),

  item(
    "Reports",
    "/reports",
    "reports",
    ["DEAN"],
    "Oversight",
    ["reports.read"],
  ),

  /*
   * ========================================================================
   * REGISTRAR
   * ========================================================================
   */

  item(
    "Overview",
    "/registrar",
    "home",
    ["REGISTRAR"],
    "Workspace",
  ),

  item(
    "Enrollment",
    "/enrollment",
    "student",
    ["REGISTRAR"],
    "Student lifecycle",
    ["students.read"],
  ),

  item(
    "Course registration",
    "/course-registration",
    "registration",
    ["REGISTRAR"],
    "Student lifecycle",
    ["registration.read"],
  ),

  item(
    "Student movement",
    "/student-promotion",
    "movement",
    ["REGISTRAR"],
    "Student lifecycle",
    ["promotions.read"],
  ),

  item(
    "Certificates",
    "/certificates",
    "certificate",
    ["REGISTRAR"],
    "Student lifecycle",
    ["certificates.read"],
  ),

  item(
    "Students",
    "/students",
    "people",
    ["REGISTRAR"],
    "Student lifecycle",
    ["students.read"],
  ),

  /*
   * ========================================================================
   * HOD
   * ========================================================================
   */

  item(
    "Overview",
    "/hod",
    "home",
    ["HOD"],
    "Workspace",
  ),

  item(
    "Examinations",
    "/examinations",
    "exam",
    ["HOD"],
    "Academic",
    ["exams.read"],
  ),

  item(
    "Student movement",
    "/student-promotion",
    "movement",
    ["HOD"],
    "Academic",
    ["promotions.read"],
  ),

  item(
    "Intelligence",
    "/intelligence",
    "intelligence",
    ["HOD"],
    "Oversight",
    ["intelligence.read"],
  ),

  item(
    "Calendar",
    "/calendar",
    "calendar",
    ["HOD"],
    "Institution",
    ["calendar.read"],
  ),

  /*
   * ========================================================================
   * FACULTY
   * ========================================================================
   */

  item(
    "Overview",
    "/faculty",
    "home",
    ["FACULTY"],
    "Workspace",
  ),

  item(
    "Attendance",
    "/faculty/attendance",
    "attendance",
    ["FACULTY"],
    "Teaching",
    ["attendance.read"],
  ),

  item(
    "Assignments",
    "/faculty/assignments",
    "assignment",
    ["FACULTY"],
    "Teaching",
    ["assignments.read"],
  ),

  item(
    "Marks",
    "/faculty/marks",
    "marks",
    ["FACULTY"],
    "Teaching",
    ["marks.read"],
  ),

  item(
    "Examinations",
    "/examinations",
    "exam",
    ["FACULTY"],
    "Academic",
    ["exams.read"],
  ),

  item(
    "Calendar",
    "/calendar",
    "calendar",
    ["FACULTY"],
    "Workspace",
    ["calendar.read"],
  ),

  item(
    "Leave",
    "/leave-management",
    "leave",
    ["FACULTY"],
    "Account",
    ["leave.read"],
  ),

  /*
   * ========================================================================
   * ACCOUNTS
   * ========================================================================
   */

  item(
    "Overview",
    "/accounts",
    "home",
    ["ACCOUNTS"],
    "Workspace",
  ),

  item(
    "Fees",
    "/fees",
    "finance",
    ["ACCOUNTS"],
    "Finance",
    ["fees.read"],
  ),

  item(
    "Receipts",
    "/fees/receipts",
    "receipt",
    ["ACCOUNTS"],
    "Finance",
    ["fees.read"],
  ),

  item(
    "Reports",
    "/reports",
    "reports",
    ["ACCOUNTS"],
    "Oversight",
    ["reports.read"],
  ),

  /*
   * ========================================================================
   * HR
   * ========================================================================
   */

  item(
    "Overview",
    "/hr",
    "home",
    ["HR"],
    "Workspace",
  ),

  item(
    "Leave",
    "/leave-management",
    "leave",
    ["HR"],
    "People",
    ["leave.read"],
  ),

  item(
    "Calendar",
    "/calendar",
    "calendar",
    ["HR"],
    "Workspace",
    ["calendar.read"],
  ),

  /*
   * ========================================================================
   * ADMISSIONS
   * ========================================================================
   */

  item(
    "Overview",
    "/admissions",
    "home",
    ["ADMISSIONS"],
    "Workspace",
  ),

  item(
    "Applications",
    "/applications",
    "application",
    ["ADMISSIONS"],
    "Admissions",
    ["admissions.read"],
  ),

  /*
   * ========================================================================
   * EXAMINATION
   * ========================================================================
   */

  item(
    "Overview",
    "/examinations",
    "home",
    ["EXAMINATION"],
    "Workspace",
  ),

  item(
    "Results",
    "/results",
    "results",
    ["EXAMINATION"],
    "Academic",
    ["results.read"],
  ),

  item(
    "Calendar",
    "/calendar",
    "calendar",
    ["EXAMINATION"],
    "Workspace",
    ["calendar.read"],
  ),

  /*
   * ========================================================================
   * LIBRARIAN
   * ========================================================================
   */

  item(
    "Overview",
    "/library",
    "home",
    ["LIBRARIAN"],
    "Workspace",
  ),

  item(
    "Calendar",
    "/calendar",
    "calendar",
    ["LIBRARIAN"],
    "Workspace",
    ["calendar.read"],
  ),

  /*
   * ========================================================================
   * PLACEMENT
   * ========================================================================
   */

  item(
    "Overview",
    "/placements",
    "home",
    ["PLACEMENT"],
    "Workspace",
  ),

  item(
    "Students",
    "/students",
    "people",
    ["PLACEMENT"],
    "Placement",
    ["students.read"],
  ),

  item(
    "Reports",
    "/reports",
    "reports",
    ["PLACEMENT"],
    "Oversight",
    ["reports.read"],
  ),

  /*
   * ========================================================================
   * IT
   * ========================================================================
   */

  item(
    "Overview",
    "/it",
    "home",
    ["IT"],
    "Workspace",
  ),

  item(
    "Operations",
    "/operations",
    "settings",
    ["IT"],
    "Technology",
    ["operations.read"],
  ),

  item(
    "Users",
    "/user-management",
    "people",
    ["IT"],
    "Technology",
    ["users.read"],
  ),

  item(
    "Audit",
    "/reports",
    "audit",
    ["IT"],
    "Governance",
    ["audit.read"],
  ),

  /*
   * ========================================================================
   * CMS
   * ========================================================================
   */

  item(
    "Website",
    "/site-content",
    "website",
    ["CMS"],
    "Website",
    ["site.manage"],
  ),

  /*
   * ========================================================================
   * STUDENT
   * ========================================================================
   */

  item(
    "Overview",
    "/student",
    "home",
    ["STUDENT"],
    "My workspace",
  ),

  item(
    "Timetable",
    "/student/timetable",
    "calendar",
    ["STUDENT"],
    "Academics",
    ["timetable.read"],
  ),

  item(
    "Attendance",
    "/student/attendance",
    "attendance",
    ["STUDENT"],
    "Academics",
    ["attendance.read"],
  ),

  item(
    "Assignments",
    "/student/assignments",
    "assignment",
    ["STUDENT"],
    "Academics",
    ["assignments.read"],
  ),

  item(
    "Marks",
    "/student/marks",
    "marks",
    ["STUDENT"],
    "Academics",
    ["marks.read"],
  ),

  item(
    "Results",
    "/student/results",
    "results",
    ["STUDENT"],
    "Academics",
    ["results.read"],
  ),

  item(
    "Examinations",
    "/student/examinations",
    "exam",
    ["STUDENT"],
    "Academics",
    ["exams.read"],
  ),

  item(
    "Course registration",
    "/student/course-registration",
    "registration",
    ["STUDENT"],
    "Student services",
    ["registration.submit"],
  ),

  item(
    "Fees",
    "/student/fees",
    "finance",
    ["STUDENT"],
    "Student services",
    ["fees.read"],
  ),

  item(
    "Library",
    "/student/library",
    "library",
    ["STUDENT"],
    "Student services",
    ["library.read"],
  ),

  item(
    "Certificates",
    "/student/certificates",
    "certificate",
    ["STUDENT"],
    "Student services",
    ["certificates.request"],
  ),

  item(
    "Leave",
    "/student/leave",
    "leave",
    ["STUDENT"],
    "Student services",
    ["leave.apply"],
  ),

  item(
    "Calendar",
    "/student/calendar",
    "calendar",
    ["STUDENT"],
    "Student services",
    ["calendar.read"],
  ),

  item(
    "Notifications",
    "/student/notifications",
    "bell",
    ["STUDENT"],
    "Student services",
    ["notifications.read"],
  ),

  item(
    "Profile",
    "/student/profile",
    "profile",
    ["STUDENT"],
    "Account",
  ),

  item(
    "LMS",
    "/lms",
    "lms",
    ["STUDENT"],
    "Learning",
    ["lms.read"],
  ),

  /*
   * ========================================================================
   * PARENT
   * ========================================================================
   */

  item(
    "Overview",
    "/parent",
    "home",
    ["PARENT"],
    "Family",
  ),

  item(
    "Children",
    "/parent/children",
    "people",
    ["PARENT"],
    "Family",
    ["parent-portal.read"],
  ),

  item(
    "Academic progress",
    "/parent/students",
    "results",
    ["PARENT"],
    "Family",
    ["parent-portal.read"],
  ),

  item(
    "Profile",
    "/parent/profile",
    "profile",
    ["PARENT"],
    "Account",
  ),

  /*
   * ========================================================================
   * CLUB PRESIDENT
   * ========================================================================
   */

  item(
    "Club workspace",
    "/club-president",
    "home",
    ["CLUB_PRESIDENT"],
    "Club",
    ["club.read"],
  ),
];

/* -------------------------------------------------------------------------- */
/* Role helpers                                                               */
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
  const role =
    primaryRole(roles) as CanonicalRole;

  return (
    NAVIGATION.find(
      (entry) =>
        entry.roles.includes(role) &&
        entry.label === "Overview",
    )?.href ||
    "/login"
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation visibility                                                      */
/* -------------------------------------------------------------------------- */

export function canUseNavigationItem(
  user: AuthUser,
  navigationItem: NavigationItem,
): boolean {
  return (
    hasAnyRole(
      user,
      navigationItem.roles,
    ) &&
    hasAllPermissions(
      user,
      navigationItem.permissions || [],
    )
  );
}

export function navigationForUser(
  user: AuthUser,
): NavigationItem[] {
  const seen = new Set<string>();

  return NAVIGATION
    .filter((entry) =>
      canUseNavigationItem(
        user,
        entry,
      ),
    )
    .filter((entry) => {
      if (seen.has(entry.href)) {
        return false;
      }

      seen.add(entry.href);
      return true;
    });
}

export function navigationForRole(
  role: string,
): NavigationItem[] {
  const canonical =
    normalizeRole(role) as CanonicalRole;

  const seen = new Set<string>();

  return NAVIGATION
    .filter((entry) =>
      entry.roles.includes(
        canonical,
      ),
    )
    .filter((entry) => {
      if (seen.has(entry.href)) {
        return false;
      }

      seen.add(entry.href);
      return true;
    });
}

export function navigationGroups(
  items: NavigationItem[],
) {
  const groups = new Map<
    string,
    NavigationItem[]
  >();

  for (const entry of items) {
    groups.set(
      entry.group,
      [
        ...(groups.get(entry.group) || []),
        entry,
      ],
    );
  }

  return [...groups.entries()].map(
    ([label, groupItems]) => ({
      label,
      items: groupItems,
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
        (entry) =>
          pathname === entry.href ||
          (
            entry.href !== "/" &&
            pathname.startsWith(
              `${entry.href}/`,
            )
          ),
      )
      .sort(
        (left, right) =>
          right.href.length -
          left.href.length,
      )[0]?.href ||
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Route authority                                                            */
/* -------------------------------------------------------------------------- */

export function canAccessWorkspace(
  user: AuthUser,
  allowedRoles?: readonly string[],
): boolean {
  return (
    !allowedRoles?.length ||
    hasAnyRole(
      user,
      allowedRoles,
    )
  );
}

function routeMatches(
  pathname: string,
  route: string,
): boolean {
  return (
    pathname === route ||
    pathname.startsWith(
      `${route}/`,
    )
  );
}

/**
 * Final frontend route gate.
 *
 * There is deliberately no second role-route registry here.
 * The navigation registry is the route authority.
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

  if (
    routeMatches(
      pathname,
      "/account-security",
    )
  ) {
    return true;
  }

  const normalizedRoles =
    user.roles.map(
      normalizeRole,
    );

  return NAVIGATION.some(
    (entry) =>
      entry.roles.some(
        (role) =>
          normalizedRoles.includes(
            role,
          ),
      ) &&
      routeMatches(
        pathname,
        entry.href,
      ) &&
      hasAllPermissions(
        user,
        entry.permissions || [],
      ),
  );
}
