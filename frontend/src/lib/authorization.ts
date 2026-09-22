/**
 * ACADLYX — Frontend Authorization Helpers
 *
 * IMPORTANT:
 * These helpers are for UI authorization only.
 *
 * They must never be treated as the security boundary.
 * The backend must independently enforce:
 *
 *   permission
 *   + action authority
 *   + institution scope
 *   + department/program/course scope
 *   + ownership
 *   + workflow authority
 *
 * Frontend responsibility:
 *   - hide unavailable navigation
 *   - disable unavailable actions
 *   - prevent confusing UI states
 *
 * Backend responsibility:
 *   - reject unauthorized requests
 *   - enforce record scope
 *   - enforce workflow authority
 *   - enforce ownership
 */

import type { AuthUser } from "./auth";

/* -------------------------------------------------------------------------- */
/* Canonical roles                                                            */
/* -------------------------------------------------------------------------- */

export const CANONICAL_ROLES = [
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

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

/**
 * Legacy role names are retained only so old sessions / old database
 * assignments can be interpreted safely while the migration is completed.
 *
 * They are NOT separate authority models.
 */
export const LEGACY_ROLE_ALIASES: Record<string, CanonicalRole> = {
  MANAGEMENT: "CHAIRMAN",
  STAFF: "ACCOUNTS",
};

export function normalizeRole(role: string): string {
  const normalized = role.trim().toUpperCase();

  return LEGACY_ROLE_ALIASES[normalized] || normalized;
}

export function normalizeRoles(
  roles: readonly string[] | null | undefined
): string[] {
  if (!Array.isArray(roles)) {
    return [];
  }

  return Array.from(
    new Set(
      roles
        .filter((role): role is string => typeof role === "string")
        .map(normalizeRole)
        .filter(Boolean)
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Permission type                                                            */
/* -------------------------------------------------------------------------- */

export type PermissionKey = string;

/* -------------------------------------------------------------------------- */
/* Basic capability checks                                                    */
/* -------------------------------------------------------------------------- */

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user) {
    return false;
  }

  if (!Array.isArray(user.permissions)) {
    return false;
  }

  return user.permissions.includes(permission);
}

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: readonly PermissionKey[]
): boolean {
  if (!user || !Array.isArray(user.permissions)) {
    return false;
  }

  return permissions.some((permission) =>
    user.permissions.includes(permission)
  );
}

export function hasAllPermissions(
  user: AuthUser | null | undefined,
  permissions: readonly PermissionKey[]
): boolean {
  if (!user || !Array.isArray(user.permissions)) {
    return false;
  }

  return permissions.every((permission) =>
    user.permissions.includes(permission)
  );
}

/**
 * Capability alias.
 *
 * Use this in application code when the question is:
 *
 *   "Can this user perform this capability?"
 *
 * rather than:
 *
 *   "Does this user have role X?"
 */
export function can(
  user: AuthUser | null | undefined,
  permission: PermissionKey
): boolean {
  return hasPermission(user, permission);
}

export function canAny(
  user: AuthUser | null | undefined,
  permissions: readonly PermissionKey[]
): boolean {
  return hasAnyPermission(user, permissions);
}

export function canAll(
  user: AuthUser | null | undefined,
  permissions: readonly PermissionKey[]
): boolean {
  return hasAllPermissions(user, permissions);
}

/* -------------------------------------------------------------------------- */
/* Role identity checks                                                       */
/* -------------------------------------------------------------------------- */

export function hasRole(
  user: AuthUser | null | undefined,
  role: string
): boolean {
  if (!user) {
    return false;
  }

  const expected = normalizeRole(role);
  const roles = normalizeRoles(user.roles);

  return roles.includes(expected);
}

export function hasAnyRole(
  user: AuthUser | null | undefined,
  roles: readonly string[]
): boolean {
  if (!user) {
    return false;
  }

  const actualRoles = normalizeRoles(user.roles);

  return roles.some((role) =>
    actualRoles.includes(normalizeRole(role))
  );
}

export function hasAllRoles(
  user: AuthUser | null | undefined,
  roles: readonly string[]
): boolean {
  if (!user) {
    return false;
  }

  const actualRoles = normalizeRoles(user.roles);

  return roles.every((role) =>
    actualRoles.includes(normalizeRole(role))
  );
}

/* -------------------------------------------------------------------------- */
/* Identity helpers                                                           */
/* -------------------------------------------------------------------------- */

export function isSuperAdmin(
  user: AuthUser | null | undefined
): boolean {
  return hasRole(user, "SUPER_ADMIN");
}

export function isInstitutionUser(
  user: AuthUser | null | undefined
): boolean {
  if (!user) {
    return false;
  }

  return (
    normalizeRoles(user.roles).length > 0 &&
    !isSuperAdmin(user)
  );
}

export function isSelf(
  user: AuthUser | null | undefined,
  targetUserId: string | null | undefined
): boolean {
  if (!user || !targetUserId) {
    return false;
  }

  return user.id === targetUserId;
}

export function isSameInstitution(
  user: AuthUser | null | undefined,
  institutionId: string | null | undefined
): boolean {
  if (!user || !user.institutionId || !institutionId) {
    return false;
  }

  return user.institutionId === institutionId;
}

/* -------------------------------------------------------------------------- */
/* Scope model                                                                */
/* -------------------------------------------------------------------------- */

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
  courseId?: string | null;
  sectionId?: string | null;
  studentId?: string | null;
  userId?: string | null;
  clubId?: string | null;
}

/**
 * Frontend scope checks are intentionally conservative.
 *
 * If the UI cannot prove that a record is inside the user's known scope,
 * it should not expose an action that assumes access.
 */
export function isWithinKnownScope(
  user: AuthUser | null | undefined,
  scope: AuthorizationScope
): boolean {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return scope.type === "PLATFORM" || Boolean(scope.institutionId);
  }

  if (
    scope.institutionId &&
    user.institutionId &&
    scope.institutionId !== user.institutionId
  ) {
    return false;
  }

  switch (scope.type) {
    case "PLATFORM":
      return false;

    case "INSTITUTION":
      return Boolean(user.institutionId);

    case "SELF":
      return Boolean(
        scope.userId &&
          scope.userId === user.id
      );

    /*
     * These scopes require authoritative server-side information.
     *
     * The frontend cannot infer department/program/course ownership
     * merely from a role. Therefore an explicit server-provided scope
     * identifier is required before presenting an operation as available.
     */
    case "SCHOOL":
    case "DEPARTMENT":
    case "PROGRAM":
    case "COURSE":
    case "SECTION":
    case "LINKED_CHILD":
    case "CLUB":
      return Boolean(scope.institutionId);
  }
}

/* -------------------------------------------------------------------------- */
/* User-target helpers                                                        */
/* -------------------------------------------------------------------------- */

export interface UserTarget {
  id: string;
  institutionId?: string | null;
  ownerUserId?: string | null;
  studentId?: string | null;
  parentUserId?: string | null;
}

/**
 * Conservative frontend target check.
 *
 * This is deliberately NOT a replacement for backend ownership checks.
 */
export function canAccessUserTarget(
  user: AuthUser | null | undefined,
  target: UserTarget
): boolean {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  if (
    target.institutionId &&
    user.institutionId &&
    target.institutionId !== user.institutionId
  ) {
    return false;
  }

  return (
    target.id === user.id ||
    target.ownerUserId === user.id ||
    target.parentUserId === user.id
  );
}

/* -------------------------------------------------------------------------- */
/* Student relationship helpers                                               */
/* -------------------------------------------------------------------------- */

export interface StudentRelationshipTarget {
  studentId: string;
  institutionId?: string | null;
  userId?: string | null;
  parentUserId?: string | null;
  isOwnRecord?: boolean;
  isLinkedChild?: boolean;
}

export function canAccessStudentTarget(
  user: AuthUser | null | undefined,
  target: StudentRelationshipTarget
): boolean {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  if (
    target.institutionId &&
    user.institutionId &&
    target.institutionId !== user.institutionId
  ) {
    return false;
  }

  if (
    hasRole(user, "STUDENT") &&
    target.userId === user.id
  ) {
    return true;
  }

  if (
    hasRole(user, "PARENT") &&
    target.parentUserId === user.id
  ) {
    return true;
  }

  return Boolean(
    target.isOwnRecord ||
      target.isLinkedChild
  );
}

/* -------------------------------------------------------------------------- */
/* Workflow authority                                                         */
/* -------------------------------------------------------------------------- */

export type WorkflowAction =
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "SUBMIT"
  | "PUBLISH"
  | "LOCK"
  | "ISSUE"
  | "REFUND"
  | "RECONCILE";

const WORKFLOW_PERMISSION_MAP: Record<
  WorkflowAction,
  PermissionKey[]
> = {
  READ: [],
  CREATE: [],
  UPDATE: [],
  DELETE: [],
  APPROVE: [],
  REJECT: [],
  SUBMIT: [],
  PUBLISH: [],
  LOCK: [],
  ISSUE: [],
  REFUND: [],
  RECONCILE: [],
};

/**
 * Allows later modules to define workflow-specific capabilities without
 * teaching the dashboard about role names.
 */
export function hasWorkflowPermission(
  user: AuthUser | null | undefined,
  action: WorkflowAction,
  additionalPermissions: readonly PermissionKey[] = []
): boolean {
  const configured =
    WORKFLOW_PERMISSION_MAP[action] || [];

  return hasAnyPermission(user, [
    ...configured,
    ...additionalPermissions,
  ]);
}

/* -------------------------------------------------------------------------- */
/* Module capability helpers                                                  */
/* -------------------------------------------------------------------------- */

export const CAPABILITIES = {
  users: {
    read: "users.read",
    create: "users.create",
    update: "users.update",
    delete: "users.delete",
  },

  students: {
    read: "students.read",
    create: "students.create",
    update: "students.update",
  },

  academics: {
    departmentsRead: "departments.read",
    departmentsCreate: "departments.create",
    departmentsUpdate: "departments.update",
    departmentsDelete: "departments.delete",

    programsRead: "programs.read",
    programsCreate: "programs.create",
    programsUpdate: "programs.update",
    programsDelete: "programs.delete",

    academicYearsRead: "academic-years.read",
    academicYearsCreate: "academic-years.create",
    academicYearsUpdate: "academic-years.update",

    semestersRead: "semesters.read",
    semestersCreate: "semesters.create",
    semestersUpdate: "semesters.update",
    semestersDelete: "semesters.delete",

    sectionsRead: "sections.read",
    sectionsCreate: "sections.create",
    sectionsUpdate: "sections.update",
    sectionsDelete: "sections.delete",

    coursesRead: "courses.read",
    coursesCreate: "courses.create",
    coursesUpdate: "courses.update",
    coursesDelete: "courses.delete",

    offeringsRead: "course-offerings.read",
    offeringsCreate: "course-offerings.create",
    offeringsUpdate: "course-offerings.update",
    offeringsDelete: "course-offerings.delete",
  },

  attendance: {
    read: "attendance.read",
    mark: "attendance.mark",
    correct: "attendance.correct",
    approve: "attendance.approve",
    lock: "attendance.lock",
    policy: "attendance.policy",
  },

  assignments: {
    read: "assignments.read",
    create: "assignments.create",
    update: "assignments.update",
    review: "assignments.review",
    submit: "assignments.submit",
  },

  marks: {
    read: "marks.read",
    enter: "marks.enter",
  },

  examinations: {
    read: "exams.read",
    manage: "exams.manage",
    approve: "exams.approve",
    invigilate: "exams.invigilate",
    revaluate: "exams.revaluate",
    resultsRead: "results.read",
  },

  fees: {
    read: "fees.read",
    manage: "fees.manage",
    pay: "fees.pay",
    refund: "fees.refund",
    approve: "fees.approve",
    reconcile: "fees.reconcile",
  },

  admissions: {
    read: "admissions.read",
    manage: "admissions.manage",
  },

  hr: {
    read: "hr.read",
    manage: "hr.manage",
  },

  leave: {
    apply: "leave.apply",
    read: "leave.read",
    approve: "leave.approve",
    manage: "leave.manage",
  },

  library: {
    read: "library.read",
    borrow: "library.borrow",
    manage: "library.manage",
  },

  registration: {
    submit: "registration.submit",
    read: "registration.read",
    approve: "registration.approve",
  },

  promotions: {
    read: "promotions.read",
    manage: "promotions.manage",
    approve: "promotions.approve",
  },

  certificates: {
    request: "certificates.request",
    read: "certificates.read",
    issue: "certificates.issue",
  },

  site: {
    manage: "site.manage",
  },

  reports: {
    read: "reports.read",
  },

  intelligence: {
    read: "intelligence.read",
  },

  imports: {
    manage: "imports.manage",
  },

  calendar: {
    read: "calendar.read",
    manage: "calendar.manage",
  },

  operations: {
    read: "operations.read",
    manage: "operations.manage",
    maintenanceRaise: "maintenance.raise",
  },

  documents: {
    read: "documents.read",
    manage: "documents.manage",
  },

  notifications: {
    read: "notifications.read",
    manage: "notifications.manage",
  },

  parentLinks: {
    read: "parent-links.read",
    manage: "parent-links.manage",
    portalRead: "parent-portal.read",
  },

  audit: {
    read: "audit.read",
  },

  campuses: {
    read: "campuses.read",
    create: "campuses.create",
    update: "campuses.update",
    delete: "campuses.delete",
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Navigation capability model                                                */
/* -------------------------------------------------------------------------- */

export interface CapabilityRequirement {
  any?: readonly PermissionKey[];
  all?: readonly PermissionKey[];
}

/**
 * A navigation item can require one or more capabilities.
 *
 * This lets DashboardShell evolve from:
 *
 *   role -> menu
 *
 * into:
 *
 *   dashboard identity -> capability-aware menu
 *
 * without granting additional authority.
 */
export function satisfiesCapabilityRequirement(
  user: AuthUser | null | undefined,
  requirement?: CapabilityRequirement
): boolean {
  if (!requirement) {
    return true;
  }

  if (
    requirement.all &&
    !hasAllPermissions(user, requirement.all)
  ) {
    return false;
  }

  if (
    requirement.any &&
    !hasAnyPermission(user, requirement.any)
  ) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Safe route guard                                                           */
/* -------------------------------------------------------------------------- */

export function canOpenRoute(
  user: AuthUser | null | undefined,
  requirement?: CapabilityRequirement
): boolean {
  return satisfiesCapabilityRequirement(
    user,
    requirement
  );
}

/* -------------------------------------------------------------------------- */
/* Debug-safe authorization snapshot                                          */
/* -------------------------------------------------------------------------- */

/**
 * Useful for development/debug screens.
 *
 * Do not expose secrets or access tokens here.
 */
export function getAuthorizationSnapshot(
  user: AuthUser | null | undefined
): {
  authenticated: boolean;
  userId: string | null;
  institutionId: string | null;
  roles: string[];
  permissions: string[];
} {
  if (!user) {
    return {
      authenticated: false,
      userId: null,
      institutionId: null,
      roles: [],
      permissions: [],
    };
  }

  return {
    authenticated: true,
    userId: user.id,
    institutionId: user.institutionId,
    roles: normalizeRoles(user.roles),
    permissions: Array.from(
      new Set(user.permissions)
    ),
  };
}
