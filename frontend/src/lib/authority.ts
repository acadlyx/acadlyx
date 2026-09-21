import {
  AuthUser,
} from "@/lib/auth";

/**
 * Frontend authority helpers.
 *
 * These helpers control UI visibility only.
 *
 * Backend authorization remains authoritative.
 *
 * Never use this file as a security boundary.
 */

export const FRONTEND_PERMISSIONS = [
  "users.read",
  "users.create",
  "users.update",
  "users.delete",

  "students.read",
  "students.create",
  "students.update",

  "attendance.read",
  "attendance.mark",
  "attendance.correct",
  "attendance.approve",
  "attendance.lock",

  "assignments.read",
  "assignments.create",
  "assignments.update",
  "assignments.review",
  "assignments.submit",

  "marks.read",
  "marks.enter",

  "site.manage",

  "imports.manage",

  "reports.read",
  "intelligence.read",

  "institutions.manage",

  "departments.read",
  "departments.create",
  "departments.update",
  "departments.delete",

  "programs.read",
  "programs.create",
  "programs.update",
  "programs.delete",

  "academic-years.read",
  "academic-years.create",
  "academic-years.update",

  "semesters.read",
  "semesters.create",
  "semesters.update",
  "semesters.delete",

  "sections.read",
  "sections.create",
  "sections.update",
  "sections.delete",

  "courses.read",
  "courses.create",
  "courses.update",
  "courses.delete",

  "course-offerings.read",
  "course-offerings.create",
  "course-offerings.update",
  "course-offerings.delete",

  "timetable.read",
  "timetable.manage",

  "notices.read",
  "notices.manage",

  "exams.read",
  "exams.manage",
  "exams.approve",
  "exams.invigilate",
  "exams.revaluate",

  "results.read",

  "fees.read",
  "fees.manage",
  "fees.pay",
  "fees.refund",
  "fees.approve",
  "fees.reconcile",

  "parent-links.read",
  "parent-links.manage",
  "parent-portal.read",

  "notifications.read",
  "notifications.manage",

  "documents.read",
  "documents.manage",

  "admissions.read",
  "admissions.manage",

  "hr.read",
  "hr.manage",

  "leave.apply",
  "leave.read",
  "leave.approve",
  "leave.manage",

  "library.read",
  "library.borrow",
  "library.manage",

  "calendar.read",
  "calendar.manage",

  "registration.submit",
  "registration.read",
  "registration.approve",

  "promotions.read",
  "promotions.manage",
  "promotions.approve",

  "certificates.request",
  "certificates.read",
  "certificates.issue",

  "audit.read",

  "lms.read",
  "lms.manage",
  "lms.attempt",
  "lms.grade",

  "operations.read",
  "operations.manage",
  "maintenance.raise",

  "campuses.read",
  "campuses.create",
  "campuses.update",
  "campuses.delete",

  "plans.manage",
] as const;

export type FrontendPermission =
  (typeof FRONTEND_PERMISSIONS)[number];

export const DASHBOARD_IDS = [
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

export type DashboardId =
  (typeof DASHBOARD_IDS)[number];

const ROLE_ALIASES: Record<
  string,
  string
> = {
  MANAGEMENT: "CHAIRMAN",
  STAFF: "ACCOUNTS",
};

const DASHBOARD_PRIORITY = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
  "CMS",
  "FACULTY",
  "CLUB_PRESIDENT",
  "STUDENT",
  "PARENT",
] as const;

export function normalizeRole(
  role: string
): string {
  return (
    ROLE_ALIASES[
      role
    ] ?? role
  );
}

export function getCanonicalRoles(
  roles: readonly string[]
): string[] {
  const result =
    new Set<string>();

  for (const role of roles) {
    result.add(
      normalizeRole(
        role
      )
    );
  }

  return [...result];
}

export function getPrimaryRole(
  roles: readonly string[]
): string | null {
  const canonical =
    getCanonicalRoles(
      roles
    );

  return (
    DASHBOARD_PRIORITY.find(
      (role) =>
        canonical.includes(
          role
        )
    ) ??
    canonical[0] ??
    null
  );
}

export function getDashboardId(
  roles: readonly string[]
): DashboardId | null {
  const role =
    getPrimaryRole(
      roles
    );

  if (
    !role ||
    !(
      DASHBOARD_IDS as
        readonly string[]
    ).includes(role)
  ) {
    return null;
  }

  return role as DashboardId;
}

export function isDashboard(
  user: AuthUser | null,
  dashboard: DashboardId
): boolean {
  if (!user) {
    return false;
  }

  return (
    getDashboardId(
      user.roles
    ) === dashboard
  );
}

/**
 * The backend should eventually expose effective permissions in the
 * authenticated-user payload. Until that contract is introduced, this
 * function intentionally supports both:
 *
 *   user.permissions
 *   user.capabilities
 *
 * without inventing permissions on the client.
 */
function getUserPermissionList(
  user: AuthUser
): string[] {
  const candidate =
    user as AuthUser & {
      permissions?: string[];
      capabilities?: string[];
    };

  return [
    ...(candidate.permissions ??
      []),
    ...(candidate.capabilities ??
      []),
  ];
}

export function hasPermission(
  user: AuthUser | null,
  permission: string
): boolean {
  if (!user) {
    return false;
  }

  const permissions =
    getUserPermissionList(
      user
    );

  return permissions.includes(
    permission
  );
}

export function hasAnyPermission(
  user: AuthUser | null,
  permissions: readonly string[]
): boolean {
  return permissions.some(
    (permission) =>
      hasPermission(
        user,
        permission
      )
  );
}

export function hasAllPermissions(
  user: AuthUser | null,
  permissions: readonly string[]
): boolean {
  return permissions.every(
    (permission) =>
      hasPermission(
        user,
        permission
      )
  );
}

export function isSuperAdmin(
  user: AuthUser | null
): boolean {
  return Boolean(
    user?.roles.some(
      (role) =>
        normalizeRole(
          role
        ) === "SUPER_ADMIN"
    )
  );
}

export function isSelf(
  user: AuthUser | null,
  userId: string
): boolean {
  return Boolean(
    user &&
      user.id === userId
  );
}

export function sameInstitution(
  user: AuthUser | null,
  institutionId: string | null | undefined
): boolean {
  if (!user) {
    return false;
  }

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  return Boolean(
    institutionId &&
      user.institutionId ===
        institutionId
  );
}

/**
 * Frontend route guards should use this function in addition to
 * DashboardShell's route protection.
 */
export function canOpenDashboard(
  user: AuthUser | null,
  dashboard: DashboardId
): boolean {
  return isDashboard(
    user,
    dashboard
  );
}

/**
 * A UI action can only be displayed when the user has the required
 * capability.
 *
 * This does not replace backend authorization.
 */
export function canRenderAction(
  user: AuthUser | null,
  permission: string
): boolean {
  return hasPermission(
    user,
    permission
  );
}

/**
 * Explicit frontend guard for platform-only operations.
 */
export function canRenderPlatformAction(
  user: AuthUser | null,
  permission: string
): boolean {
  if (
    permission ===
      "institutions.manage" ||
    permission ===
      "plans.manage"
  ) {
    return isSuperAdmin(
      user
    );
  }

  return canRenderAction(
    user,
    permission
  );
}

/**
 * Explicit frontend guard for the CMS.
 *
 * CMS is intentionally not treated as a general administrator role.
 */
export function canManageCms(
  user: AuthUser | null
): boolean {
  return hasPermission(
    user,
    "site.manage"
  );
}

/**
 * Explicit frontend guard for club operations.
 *
 * Club President remains a single dedicated responsibility.
 */
export function canUseClubWorkspace(
  user: AuthUser | null
): boolean {
  return isDashboard(
    user,
    "CLUB_PRESIDENT"
  );
}
