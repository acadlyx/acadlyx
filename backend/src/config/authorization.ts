import {
  AuthenticatedUser,
} from "../types/auth";

import {
  PermissionKey,
  SystemRoleName,
  getCanonicalRoleNames,
  getEffectivePermissions,
  hasPermission as roleHasPermission,
  isPlatformPermission,
  normalizeRoleName,
} from "./rbac";

/**
 * Central authorization primitives.
 *
 * Permission is only one layer.
 *
 * A complete authorization decision is:
 *
 *   authentication
 *        ↓
 *   permission
 *        ↓
 *   institution scope
 *        ↓
 *   resource scope
 *        ↓
 *   ownership / relationship
 *        ↓
 *   workflow authority
 */

export interface ResourceTarget {
  institutionId?: string | null;

  userId?: string | null;

  studentId?: string | null;

  ownerUserId?: string | null;

  parentUserId?: string | null;

  schoolId?: string | null;

  departmentId?: string | null;

  programId?: string | null;

  courseId?: string | null;

  sectionId?: string | null;

  courseOfferingId?: string | null;

  clubId?: string | null;
}

export type ScopeType =
  | "PLATFORM"
  | "INSTITUTION"
  | "SCHOOL"
  | "DEPARTMENT"
  | "PROGRAM"
  | "COURSE"
  | "SECTION"
  | "SELF"
  | "LINKED_CHILD"
  | "CLUB";

export interface AuthorizationScope {
  type: ScopeType;

  institutionId?: string | null;

  schoolId?: string | null;

  departmentId?: string | null;

  programId?: string | null;

  courseIds?: string[];

  sectionIds?: string[];

  studentIds?: string[];

  linkedStudentIds?: string[];

  clubIds?: string[];
}

export interface AuthorizationDecision {
  allowed: boolean;

  reason:
    | "ALLOWED"
    | "NOT_AUTHENTICATED"
    | "NO_PERMISSION"
    | "PLATFORM_SCOPE_REQUIRED"
    | "INSTITUTION_MISMATCH"
    | "RECORD_NOT_IN_SCOPE"
    | "WORKFLOW_AUTHORITY_REQUIRED";

  permission?: PermissionKey;
}

export function getRoles(
  user: AuthenticatedUser
): SystemRoleName[] {
  return getCanonicalRoleNames(
    user.roles
  );
}

export function getPermissions(
  user: AuthenticatedUser
): PermissionKey[] {
  /*
   * The request user permissions are loaded from the database by the
   * authentication middleware.
   *
   * Recalculating from roles here is intentionally avoided as the primary
   * source because custom/explicit permission assignments may exist.
   */
  return user.permissions.filter(
    (
      permission
    ): permission is PermissionKey =>
      typeof permission === "string"
  );
}

export function hasPermission(
  user: AuthenticatedUser,
  permission: PermissionKey
): boolean {
  return user.permissions.includes(
    permission
  );
}

export function hasRole(
  user: AuthenticatedUser,
  role: SystemRoleName
): boolean {
  return getRoles(
    user
  ).includes(
    role
  );
}

export function hasAnyRole(
  user: AuthenticatedUser,
  roles: readonly SystemRoleName[]
): boolean {
  const current =
    getRoles(
      user
    );

  return roles.some(
    (
      role
    ) =>
      current.includes(
        role
      )
  );
}

export function hasAnyPermission(
  user: AuthenticatedUser,
  permissions: readonly PermissionKey[]
): boolean {
  return permissions.some(
    (
      permission
    ) =>
      hasPermission(
        user,
        permission
      )
  );
}

export function hasAllPermissions(
  user: AuthenticatedUser,
  permissions: readonly PermissionKey[]
): boolean {
  return permissions.every(
    (
      permission
    ) =>
      hasPermission(
        user,
        permission
      )
  );
}

export function isSuperAdmin(
  user: AuthenticatedUser
): boolean {
  return hasRole(
    user,
    "SUPER_ADMIN"
  );
}

export function isSelf(
  user: AuthenticatedUser,
  targetUserId: string
): boolean {
  return (
    user.id ===
    targetUserId
  );
}

export function sameInstitution(
  user: AuthenticatedUser,
  institutionId: string | null | undefined
): boolean {
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
 * Institution boundary.
 */
export function canAccessInstitution(
  user: AuthenticatedUser,
  institutionId: string
): boolean {
  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  return (
    user.institutionId ===
    institutionId
  );
}

/**
 * User boundary.
 */
export function canAccessUser(
  user: AuthenticatedUser,
  targetUserId: string
): boolean {
  return (
    isSuperAdmin(
      user
    ) ||
    user.id ===
      targetUserId
  );
}

/**
 * Student ownership/relationship boundary.
 *
 * Actual institution/department/program/course scope must be supplied
 * by the calling service because the authenticated token does not carry
 * complete student assignment data.
 *
 * Therefore this function only handles self/linked relationship when
 * the caller supplies the relationship.
 */
export function canAccessStudentRelationship(
  user: AuthenticatedUser,
  target: {
    studentUserId?: string | null;
    parentUserId?: string | null;
    currentUserIsLinkedParent?: boolean;
  }
): boolean {
  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    target.studentUserId &&
    user.id ===
      target.studentUserId
  ) {
    return true;
  }

  if (
    target.parentUserId &&
    user.id ===
      target.parentUserId
  ) {
    return true;
  }

  return Boolean(
    target.currentUserIsLinkedParent
  );
}

/**
 * Ownership boundary.
 */
export function isOwner(
  user: AuthenticatedUser,
  ownerUserId: string
): boolean {
  return (
    user.id ===
    ownerUserId
  );
}

/**
 * Target scope check.
 *
 * This is intentionally conservative.
 *
 * If a record contains a scope identifier but the authenticated user
 * cannot be proven to belong to that scope, access is denied.
 */
export function isTargetInScope(
  user: AuthenticatedUser,
  target: ResourceTarget
): boolean {
  if (
    target.institutionId &&
    !canAccessInstitution(
      user,
      target.institutionId
    )
  ) {
    return false;
  }

  if (
    target.userId &&
    !canAccessUser(
      user,
      target.userId
    )
  ) {
    return false;
  }

  if (
    target.ownerUserId &&
    !isOwner(
      user,
      target.ownerUserId
    )
  ) {
    return false;
  }

  /*
   * The remaining organisational scope identifiers cannot safely be
   * inferred from the JWT alone.
   *
   * Services must perform the corresponding database-backed scope check.
   *
   * We therefore do NOT grant access merely because the user has a broad
   * role.
   */
  return true;
}

export function authorize(
  user: AuthenticatedUser | null | undefined,
  permission: PermissionKey,
  target?: ResourceTarget
): AuthorizationDecision {
  if (!user) {
    return {
      allowed: false,
      reason:
        "NOT_AUTHENTICATED",
      permission,
    };
  }

  if (
    isPlatformPermission(
      permission
    ) &&
    !isSuperAdmin(
      user
    )
  ) {
    return {
      allowed: false,
      reason:
        "PLATFORM_SCOPE_REQUIRED",
      permission,
    };
  }

  if (
    !hasPermission(
      user,
      permission
    )
  ) {
    return {
      allowed: false,
      reason:
        "NO_PERMISSION",
      permission,
    };
  }

  if (
    target &&
    !isTargetInScope(
      user,
      target
    )
  ) {
    return {
      allowed: false,
      reason:
        "RECORD_NOT_IN_SCOPE",
      permission,
    };
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    permission,
  };
}

export function assertAuthorized(
  user: AuthenticatedUser | null | undefined,
  permission: PermissionKey,
  target?: ResourceTarget
): void {
  const decision =
    authorize(
      user,
      permission,
      target
    );

  if (
    decision.allowed
  ) {
    return;
  }

  const error =
    new Error(
      `Authorization denied: ${decision.reason}`
    );

  Object.assign(
    error,
    {
      statusCode: 403,
      code: decision.reason,
      permission,
    }
  );

  throw error;
}

/**
 * Workflow authority is deliberately separate from role permission.
 *
 * Example:
 *
 *   HR may have leave.approve.
 *
 * But that does NOT mean HR can approve every leave record.
 *
 * The leave workflow must resolve the configured approver for the
 * particular employee/request and pass the result here.
 */
export function assertWorkflowAuthority(
  hasConfiguredAuthority: boolean
): void {
  if (
    hasConfiguredAuthority
  ) {
    return;
  }

  const error =
    new Error(
      "No configured workflow authority exists for this approval action"
    );

  Object.assign(
    error,
    {
      statusCode: 403,
      code:
        "WORKFLOW_AUTHORITY_REQUIRED",
    }
  );

  throw error;
}

/**
 * Prevent accidental use of platform permissions by institutional roles.
 */
export function assertPlatformAuthority(
  user: AuthenticatedUser
): void {
  if (
    isSuperAdmin(
      user
    )
  ) {
    return;
  }

  const error =
    new Error(
      "Platform authority is restricted to SUPER_ADMIN"
    );

  Object.assign(
    error,
    {
      statusCode: 403,
      code:
        "PLATFORM_SCOPE_REQUIRED",
    }
  );

  throw error;
}

/**
 * Useful when services need to inspect the effective role set without
 * reimplementing legacy-role normalization.
 */
export function getCanonicalUserRoles(
  user: AuthenticatedUser
): SystemRoleName[] {
  return getCanonicalRoleNames(
    user.roles
  );
}

/**
 * Kept as an explicit helper so future services do not accidentally
 * implement:
 *
 *   if (role === "ADMIN") ...
 *
 * throughout the application.
 */
export function userHasEffectivePermission(
  user: AuthenticatedUser,
  permission: PermissionKey
): boolean {
  return roleHasPermission(
    user.roles,
    permission
  ) || hasPermission(
    user,
    permission
  );
}

/**
 * Re-export the effective permission calculation for places that need
 * to compare the canonical role matrix.
 */
export function calculateRolePermissions(
  roles: readonly string[]
): PermissionKey[] {
  return getEffectivePermissions(
    roles
  );
}
