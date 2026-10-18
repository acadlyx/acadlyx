import { AuthUser } from "@/lib/auth";
import { can, canAny, canAll, hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/authorization";
export { can, canAny, canAll, hasPermission, hasAnyPermission, hasAllPermissions };

/**
 * Frontend authority helpers.
 *
 * These helpers control UI visibility only.
 *
 * Backend authorization remains authoritative.
 *
 * Never use this file as a security boundary.
 */

// Permission names are intentionally not duplicated here. The authenticated
// user payload's effective permissions are the frontend capability source.
export type FrontendPermission = string;

export const DASHBOARD_IDS = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "MANAGEMENT",
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
  "STAFF",
] as const;

export type DashboardId =
  (typeof DASHBOARD_IDS)[number];

const ROLE_ALIASES: Record<string, string> = {};

/**
 * Effective workspace priority matches backend scope enforcement:
 * Chairman is the explicit institution-wide override; otherwise scoped
 * academic/owner roles are resolved before secondary administrative grants.
 * A secondary Institution Admin or specialist role must not switch a scoped
 * account into a broader dashboard.
 */
const DASHBOARD_PRIORITY = [
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "HOD",
  "FACULTY",
  "STUDENT",
  "PARENT",
  "PLACEMENT",
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "MANAGEMENT",
  "REGISTRAR",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "IT",
  "CMS",
  "CLUB_PRESIDENT",
  "STAFF",
] as const;

export function normalizeRole(
  role: string
): string {
  const normalized = role.trim().toUpperCase();
  return ROLE_ALIASES[normalized] ?? normalized;
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
    DASHBOARD_PRIORITY.find((role) => canonical.includes(role)) ?? null
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
export function isSuperAdmin(
  user: AuthUser | null
): boolean {
  // Use the same effective role selected for navigation and backend scope.
  // A secondary Super Admin binding must never override a Student/Faculty/
  // Director workspace for tenant-bound frontend decisions.
  return Boolean(user && getPrimaryRole(user.roles) === "SUPER_ADMIN");
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
  return (
    isDashboard(user, "CLUB_PRESIDENT") &&
    hasPermission(user, "club.read")
  );
}
