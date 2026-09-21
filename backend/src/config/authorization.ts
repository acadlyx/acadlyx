import {
  PermissionKey,
} from "./permissions";

import {
  getCanonicalRoleNames,
  getEffectivePermissions,
  isPlatformPermission,
  normalizeRoleName,
  SystemRoleName,
} from "./roles";

import {
  DataScope,
  getDefaultScope,
} from "./scope";

/**
 * Backend authorization foundation.
 *
 * This module deliberately keeps authorization separate from:
 *
 *   - dashboard rendering
 *   - route names
 *   - UI visibility
 *   - individual database services
 *
 * The same capability decision can therefore be reused by controllers,
 * services and workflow handlers.
 */

export interface AuthorizationUser {
  id: string;
  institutionId: string | null;
  roles: string[];

  /**
   * Optional explicit assignments.
   *
   * These fields are intentionally optional because different deployments
   * may populate them from different institutional assignment models.
   */
  schoolId?: string | null;
  departmentId?: string | null;
  programId?: string | null;

  assignedCourseIds?: string[];
  assignedSectionIds?: string[];

  studentIds?: string[];
  linkedStudentIds?: string[];

  clubIds?: string[];
}

export interface AuthorizationContext {
  user: AuthorizationUser;
  scope?: DataScope;
}

export type AuthorizationAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "manage"
  | "submit"
  | "enter"
  | "pay"
  | "refund"
  | "reconcile"
  | "publish"
  | "issue"
  | "lock"
  | "correct"
  | "attempt"
  | "grade"
  | "invigilate"
  | "revaluate";

export interface ResourceTarget {
  institutionId?: string | null;

  userId?: string | null;

  studentId?: string | null;

  parentUserId?: string | null;

  schoolId?: string | null;

  departmentId?: string | null;

  programId?: string | null;

  courseId?: string | null;

  sectionId?: string | null;

  courseOfferingId?: string | null;

  clubId?: string | null;

  ownerUserId?: string | null;
}

export interface AuthorizationDecision {
  allowed: boolean;

  reason:
    | "ALLOWED"
    | "NOT_AUTHENTICATED"
    | "NO_PERMISSION"
    | "PLATFORM_SCOPE_REQUIRED"
    | "INSTITUTION_SCOPE_REQUIRED"
    | "INSTITUTION_MISMATCH"
    | "SELF_SCOPE_REQUIRED"
    | "LINKED_CHILD_SCOPE_REQUIRED"
    | "DEPARTMENT_SCOPE_REQUIRED"
    | "SCHOOL_SCOPE_REQUIRED"
    | "PROGRAM_SCOPE_REQUIRED"
    | "COURSE_SCOPE_REQUIRED"
    | "CLUB_SCOPE_REQUIRED"
    | "RECORD_NOT_IN_SCOPE"
    | "WORKFLOW_AUTHORITY_REQUIRED";

  permission?: PermissionKey;

  scope?: DataScope;
}

/**
 * The canonical capability map.
 *
 * Most modules use permission keys directly. These aliases make the
 * authorization API easier to consume and keep controller/service code
 * readable.
 */
export const CAPABILITY_MAP = {
  readUsers: "users.read",

  createUsers: "users.create",
  updateUsers: "users.update",
  deleteUsers: "users.delete",

  readStudents: "students.read",
  createStudents: "students.create",
  updateStudents: "students.update",

  readAttendance: "attendance.read",
  markAttendance: "attendance.mark",
  correctAttendance: "attendance.correct",
  approveAttendance: "attendance.approve",
  lockAttendance: "attendance.lock",

  readAssignments: "assignments.read",
  createAssignments: "assignments.create",
  updateAssignments: "assignments.update",
  reviewAssignments: "assignments.review",
  submitAssignments: "assignments.submit",

  readMarks: "marks.read",
  enterMarks: "marks.enter",

  readExams: "exams.read",
  manageExams: "exams.manage",
  approveExams: "exams.approve",
  invigilateExams: "exams.invigilate",
  revaluateExams: "exams.revaluate",

  readResults: "results.read",

  readFees: "fees.read",
  manageFees: "fees.manage",
  payFees: "fees.pay",
  refundFees: "fees.refund",
  approveFees: "fees.approve",
  reconcileFees: "fees.reconcile",

  readAdmissions: "admissions.read",
  manageAdmissions: "admissions.manage",

  readHr: "hr.read",
  manageHr: "hr.manage",

  applyLeave: "leave.apply",
  readLeave: "leave.read",
  approveLeave: "leave.approve",
  manageLeave: "leave.manage",

  readLibrary: "library.read",
  borrowLibrary: "library.borrow",
  manageLibrary: "library.manage",

  readRegistration: "registration.read",
  submitRegistration: "registration.submit",
  approveRegistration: "registration.approve",

  readPromotions: "promotions.read",
  managePromotions: "promotions.manage",
  approvePromotions: "promotions.approve",

  readCertificates: "certificates.read",
  requestCertificates: "certificates.request",
  issueCertificates: "certificates.issue",

  readSite: "site.manage",

  readReports: "reports.read",
  readIntelligence: "intelligence.read",

  readAudit: "audit.read",

  readLms: "lms.read",
  manageLms: "lms.manage",
  attemptLms: "lms.attempt",
  gradeLms: "lms.grade",

  readOperations: "operations.read",
  manageOperations: "operations.manage",
  raiseMaintenance: "maintenance.raise",
} as const satisfies Record<
  string,
  PermissionKey
>;

export type CapabilityKey =
  (typeof CAPABILITY_MAP)[keyof typeof CAPABILITY_MAP];

export function getUserRoles(
  user: AuthorizationUser
): SystemRoleName[] {
  return getCanonicalRoleNames(
    user.roles
  );
}

export function getUserPermissions(
  user: AuthorizationUser
): PermissionKey[] {
  return getEffectivePermissions(
    user.roles
  );
}

export function hasPermission(
  user: AuthorizationUser,
  permission: PermissionKey
): boolean {
  /**
   * Platform permissions are intentionally special.
   *
   * A normal institution administrator must never receive platform
   * permissions simply because another role grants broad permissions.
   */
  if (
    isPlatformPermission(
      permission
    )
  ) {
    return user.roles.some(
      (role) =>
        normalizeRoleName(
          role
        ) === "SUPER_ADMIN"
    );
  }

  return getUserPermissions(
    user
  ).includes(permission);
}

export function hasCapability(
  user: AuthorizationUser,
  capability: CapabilityKey
): boolean {
  return hasPermission(
    user,
    capability
  );
}

export function hasAnyPermission(
  user: AuthorizationUser,
  permissions: readonly PermissionKey[]
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
  user: AuthorizationUser,
  permissions: readonly PermissionKey[]
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
  user: AuthorizationUser
): boolean {
  return user.roles.some(
    (role) =>
      normalizeRoleName(
        role
      ) === "SUPER_ADMIN"
  );
}

export function isInstitutionUser(
  user: AuthorizationUser
): boolean {
  return Boolean(
    user.institutionId
  );
}

export function getAuthorizationScope(
  context: AuthorizationContext
): DataScope {
  return (
    context.scope ??
    getDefaultScope(
      context.user as never
    )
  );
}

/**
 * Institution boundary.
 *
 * Every institution-scoped record must pass this check before any more
 * detailed scope check occurs.
 */
export function canAccessInstitution(
  context: AuthorizationContext,
  institutionId: string
): boolean {
  const {
    user,
  } = context;

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
 * User/self boundary.
 */
export function canAccessUser(
  context: AuthorizationContext,
  userId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.id === userId
  ) {
    return true;
  }

  return false;
}

/**
 * Student boundary.
 *
 * Student IDs explicitly assigned to the user are respected.
 */
export function canAccessStudent(
  context: AuthorizationContext,
  studentId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.studentIds?.includes(
      studentId
    )
  ) {
    return true;
  }

  if (
    user.linkedStudentIds?.includes(
      studentId
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Parent-child boundary.
 *
 * This intentionally does not mean:
 *
 *   PARENT -> all students in the institution.
 *
 * The child must be explicitly linked.
 */
export function canAccessLinkedStudent(
  context: AuthorizationContext,
  studentId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  return Boolean(
    user.linkedStudentIds?.includes(
      studentId
    )
  );
}

/**
 * School boundary.
 */
export function canAccessSchool(
  context: AuthorizationContext,
  schoolId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.schoolId &&
    user.schoolId === schoolId
  ) {
    return true;
  }

  /**
   * Institution-wide leadership may operate at institution level.
   *
   * They still need the underlying permission.
   */
  const roles =
    getUserRoles(
      user
    );

  return roles.some(
    (role) =>
      role ===
        "INSTITUTION_ADMIN" ||
      role === "CHAIRMAN" ||
      role === "DIRECTOR"
  );
}

/**
 * Department boundary.
 */
export function canAccessDepartment(
  context: AuthorizationContext,
  departmentId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.departmentId &&
    user.departmentId ===
      departmentId
  ) {
    return true;
  }

  const roles =
    getUserRoles(
      user
    );

  return roles.some(
    (role) =>
      role ===
        "INSTITUTION_ADMIN" ||
      role === "CHAIRMAN" ||
      role === "DIRECTOR" ||
      role === "DEAN" ||
      role === "REGISTRAR"
  );
}

/**
 * Program boundary.
 */
export function canAccessProgram(
  context: AuthorizationContext,
  programId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.programId &&
    user.programId ===
      programId
  ) {
    return true;
  }

  const roles =
    getUserRoles(
      user
    );

  return roles.some(
    (role) =>
      role ===
        "INSTITUTION_ADMIN" ||
      role === "CHAIRMAN" ||
      role === "DIRECTOR" ||
      role === "DEAN" ||
      role === "REGISTRAR"
  );
}

/**
 * Course boundary.
 */
export function canAccessCourse(
  context: AuthorizationContext,
  courseId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.assignedCourseIds?.includes(
      courseId
    )
  ) {
    return true;
  }

  const roles =
    getUserRoles(
      user
    );

  return roles.some(
    (role) =>
      role ===
        "INSTITUTION_ADMIN" ||
      role === "CHAIRMAN" ||
      role === "DIRECTOR" ||
      role === "DEAN" ||
      role === "REGISTRAR" ||
      role === "HOD"
  );
}

/**
 * Section boundary.
 */
export function canAccessSection(
  context: AuthorizationContext,
  sectionId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  if (
    user.assignedSectionIds?.includes(
      sectionId
    )
  ) {
    return true;
  }

  const roles =
    getUserRoles(
      user
    );

  return roles.some(
    (role) =>
      role ===
        "INSTITUTION_ADMIN" ||
      role === "CHAIRMAN" ||
      role === "DIRECTOR" ||
      role === "DEAN" ||
      role === "REGISTRAR" ||
      role === "HOD"
  );
}

/**
 * Club boundary.
 */
export function canAccessClub(
  context: AuthorizationContext,
  clubId: string
): boolean {
  const {
    user,
  } = context;

  if (
    isSuperAdmin(
      user
    )
  ) {
    return true;
  }

  return Boolean(
    user.clubIds?.includes(
      clubId
    )
  );
}

/**
 * Ownership check.
 *
 * Ownership is deliberately stricter than role possession.
 */
export function isOwner(
  context: AuthorizationContext,
  ownerUserId: string
): boolean {
  return (
    context.user.id ===
    ownerUserId
  );
}

/**
 * Central target-scope evaluator.
 */
export function isTargetInScope(
  context: AuthorizationContext,
  target: ResourceTarget
): boolean {
  const {
    user,
  } = context;

  if (
    target.institutionId &&
    !canAccessInstitution(
      context,
      target.institutionId
    )
  ) {
    return false;
  }

  if (
    target.userId &&
    !canAccessUser(
      context,
      target.userId
    )
  ) {
    return false;
  }

  if (
    target.studentId
  ) {
    const roles =
      getUserRoles(
        user
      );

    if (
      roles.includes(
        "PARENT"
      )
    ) {
      if (
        !canAccessLinkedStudent(
          context,
          target.studentId
        )
      ) {
        return false;
      }
    } else if (
      roles.includes(
        "STUDENT"
      )
    ) {
      if (
        user.studentIds?.length &&
        !canAccessStudent(
          context,
          target.studentId
        )
      ) {
        return false;
      }
    }
  }

  if (
    target.schoolId &&
    !canAccessSchool(
      context,
      target.schoolId
    )
  ) {
    return false;
  }

  if (
    target.departmentId &&
    !canAccessDepartment(
      context,
      target.departmentId
    )
  ) {
    return false;
  }

  if (
    target.programId &&
    !canAccessProgram(
      context,
      target.programId
    )
  ) {
    return false;
  }

  if (
    target.courseId &&
    !canAccessCourse(
      context,
      target.courseId
    )
  ) {
    return false;
  }

  if (
    target.sectionId &&
    !canAccessSection(
      context,
      target.sectionId
    )
  ) {
    return false;
  }

  if (
    target.clubId &&
    !canAccessClub(
      context,
      target.clubId
    )
  ) {
    return false;
  }

  if (
    target.ownerUserId &&
    !isOwner(
      context,
      target.ownerUserId
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Basic permission + target scope decision.
 */
export function authorize(
  context: AuthorizationContext,
  permission: PermissionKey,
  target?: ResourceTarget
): AuthorizationDecision {
  const {
    user,
  } = context;

  if (!user) {
    return {
      allowed: false,
      reason: "NOT_AUTHENTICATED",
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
      reason: "NO_PERMISSION",
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
    target &&
    !isTargetInScope(
      context,
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
    scope:
      getAuthorizationScope(
        context
      ),
  };
}

/**
 * Throws a normal Error rather than allowing callers to accidentally
 * continue after a failed authorization decision.
 *
 * Controllers/services can translate this into their existing API error
 * handling layer.
 */
export function assertAuthorized(
  context: AuthorizationContext,
  permission: PermissionKey,
  target?: ResourceTarget
): void {
  const decision =
    authorize(
      context,
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
 * Explicit approval-authority gate.
 *
 * IMPORTANT:
 *
 * Having a generic "admin" role is not enough.
 *
 * A workflow must call this function when the operation is an approval.
 * The workflow layer will later supply the configured approver relationship.
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
 * Prevents normal institutional roles from using platform-level
 * permissions merely because they have broad institutional permissions.
 */
export function assertPlatformAuthority(
  user: AuthorizationUser
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
      "Platform authority is restricted to Super Admin"
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
