import {
  PERMISSIONS,
  PermissionKey,
} from "./permissions";

/**
 * Canonical Acadlyx stakeholder roles.
 *
 * These are the roles that will eventually correspond to the dedicated
 * dashboards/workspaces.
 */
export const SYSTEM_ROLE_NAMES = [
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

export type SystemRoleName =
  (typeof SYSTEM_ROLE_NAMES)[number];

/**
 * Compatibility roles from the previous architecture.
 *
 * They are deliberately NOT part of SYSTEM_ROLE_NAMES.
 * They exist only so existing deployed accounts can continue to resolve
 * during the transition.
 */
export const LEGACY_ROLE_NAMES = [
  "MANAGEMENT",
  "STAFF",
] as const;

export type LegacyRoleName =
  (typeof LEGACY_ROLE_NAMES)[number];

export type KnownRoleName =
  | SystemRoleName
  | LegacyRoleName;

export const ROLE_ALIASES: Record<
  LegacyRoleName,
  SystemRoleName
> = {
  MANAGEMENT: "CHAIRMAN",
  STAFF: "ACCOUNTS",
};

/**
 * Hierarchy used only where a workflow explicitly requires a strict
 * authority comparison.
 *
 * A rank does NOT automatically grant every permission.
 */
export const ROLE_RANK: Record<
  KnownRoleName,
  number
> = {
  SUPER_ADMIN: 100,
  INSTITUTION_ADMIN: 90,
  CHAIRMAN: 80,
  DIRECTOR: 75,
  DEAN: 70,
  REGISTRAR: 68,
  HOD: 60,

  ACCOUNTS: 55,
  HR: 55,
  ADMISSIONS: 55,
  EXAMINATION: 55,

  LIBRARIAN: 45,
  PLACEMENT: 45,
  IT: 45,

  FACULTY: 40,

  CLUB_PRESIDENT: 20,

  STUDENT: 10,
  PARENT: 10,

  CMS: 5,

  /*
   * Compatibility values only.
   */
  MANAGEMENT: 80,
  STAFF: 40,
};

const ALL_PERMISSIONS =
  PERMISSIONS.map(
    (permission) => permission.key
  ) as PermissionKey[];

const ACADEMIC_READ: PermissionKey[] = [
  "departments.read",
  "programs.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

const LEADERSHIP_READ: PermissionKey[] = [
  "users.read",
  "students.read",
  "attendance.read",
  "assignments.read",
  "marks.read",
  "reports.read",
  "intelligence.read",

  ...ACADEMIC_READ,

  "timetable.read",
  "notices.read",

  "exams.read",
  "results.read",

  "fees.read",

  "parent-links.read",
  "parent-portal.read",

  "notifications.read",
  "documents.read",

  "admissions.read",
  "hr.read",

  "leave.read",

  "library.read",

  "calendar.read",

  "registration.read",

  "promotions.read",

  "certificates.read",

  "lms.read",

  "operations.read",

  "campuses.read",
];

const STUDENT_SELF: PermissionKey[] = [
  "attendance.read",

  "assignments.read",
  "assignments.submit",

  "marks.read",

  ...ACADEMIC_READ,

  "fees.read",

  "results.read",

  "notifications.read",

  "documents.read",

  "leave.apply",

  "library.read",
  "library.borrow",

  "calendar.read",

  "registration.submit",

  "certificates.request",

  "attendance.correct",

  "exams.revaluate",

  "lms.read",
  "lms.attempt",

  "maintenance.raise",
];

/**
 * Default permissions for every canonical dashboard role.
 *
 * This is the DEFAULT capability set.
 *
 * Scope and workflow authority are still enforced separately.
 */
export const ROLE_PERMISSIONS: Record<
  KnownRoleName,
  PermissionKey[]
> = {
  SUPER_ADMIN: [
    ...ALL_PERMISSIONS,
  ],

  /*
   * Institution Admin controls institution configuration and administration.
   *
   * CMS, platform institution management and subscription-plan management
   * remain separate authorities.
   */
  INSTITUTION_ADMIN:
    ALL_PERMISSIONS.filter(
      (permission) =>
        permission !==
          "institutions.manage" &&
        permission !==
          "plans.manage" &&
        permission !==
          "site.manage"
    ),

  /*
   * Chairman / Management:
   * primarily institutional oversight and governance.
   */
  CHAIRMAN: [
    ...LEADERSHIP_READ,

    "leave.approve",

    "fees.approve",
    "fees.reconcile",

    "attendance.approve",
    "attendance.lock",

    "promotions.approve",

    "exams.approve",
    "exams.revaluate",

    "audit.read",
  ],

  /*
   * Director:
   * institution-wide leadership plus designated operational approvals.
   */
  DIRECTOR: [
    ...LEADERSHIP_READ,

    "notices.manage",
    "calendar.manage",

    "leave.approve",

    "fees.approve",
    "fees.reconcile",

    "attendance.approve",
    "attendance.lock",

    "registration.approve",
    "promotions.approve",

    "certificates.issue",

    "exams.approve",
    "exams.revaluate",

    "operations.manage",

    "audit.read",
  ],

  /*
   * Dean:
   * academic leadership within the assigned school/scope.
   */
  DEAN: [
    ...LEADERSHIP_READ,

    "assignments.review",

    "notices.manage",
    "timetable.manage",

    "registration.approve",
    "promotions.approve",

    "exams.approve",
    "exams.revaluate",

    "attendance.approve",
    "attendance.lock",
  ],

  /*
   * Registrar:
   * official academic records and student lifecycle.
   */
  REGISTRAR: [
    ...LEADERSHIP_READ,

    "users.read",

    "students.create",
    "students.update",

    "registration.read",
    "registration.approve",

    "promotions.read",
    "promotions.manage",
    "promotions.approve",

    "certificates.read",
    "certificates.issue",

    "documents.manage",

    "calendar.manage",

    "audit.read",
  ],

  /*
   * HOD:
   * department-level academic authority.
   */
  HOD: [
    "students.read",

    "attendance.read",
    "attendance.mark",

    "assignments.read",
    "assignments.review",

    "marks.read",

    "reports.read",
    "intelligence.read",

    ...ACADEMIC_READ,

    "sections.update",
    "course-offerings.update",

    "timetable.read",
    "timetable.manage",

    "notices.read",
    "notices.manage",

    "exams.read",
    "results.read",

    "parent-portal.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",

    "leave.apply",
    "leave.read",
    "leave.approve",

    "calendar.read",

    "registration.read",
    "registration.approve",

    "promotions.read",
    "promotions.manage",

    "exams.approve",
    "exams.invigilate",
    "exams.revaluate",

    "attendance.approve",
    "attendance.lock",

    "lms.read",

    "operations.read",
    "maintenance.raise",
  ],

  /*
   * Faculty:
   * teaching and assigned academic work.
   */
  FACULTY: [
    "students.read",

    "attendance.read",
    "attendance.mark",

    "assignments.read",
    "assignments.create",
    "assignments.update",
    "assignments.review",

    "marks.read",
    "marks.enter",

    ...ACADEMIC_READ,

    "timetable.read",

    "exams.read",
    "exams.manage",
    "results.read",

    "notifications.read",

    "documents.read",

    "leave.apply",

    "library.read",
    "library.borrow",

    "calendar.read",

    "exams.invigilate",

    "attendance.correct",

    "lms.read",

    "maintenance.raise",
  ],

  /*
   * Accounts:
   * financial operations.
   */
  ACCOUNTS: [
    "users.read",
    "students.read",

    "reports.read",

    ...ACADEMIC_READ,

    "fees.read",
    "fees.manage",
    "fees.pay",
    "fees.refund",
    "fees.approve",
    "fees.reconcile",

    "notifications.read",
    "documents.read",

    "leave.apply",

    "calendar.read",
  ],

  /*
   * HR:
   * employee and leave administration.
   */
  HR: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",

    "hr.read",
    "hr.manage",

    "leave.apply",
    "leave.read",
    "leave.approve",
    "leave.manage",

    "documents.read",
    "documents.manage",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "calendar.read",

    "audit.read",
  ],

  /*
   * Admissions:
   * applicant/admission lifecycle.
   */
  ADMISSIONS: [
    "students.read",
    "students.create",
    "students.update",

    "admissions.read",
    "admissions.manage",

    "documents.read",
    "documents.manage",

    "fees.read",

    "notifications.read",

    "reports.read",

    "calendar.read",
  ],

  /*
   * Examination Cell:
   * official examination lifecycle.
   */
  EXAMINATION: [
    "students.read",

    ...ACADEMIC_READ,

    "exams.read",
    "exams.manage",
    "exams.approve",
    "exams.invigilate",
    "exams.revaluate",

    "results.read",

    "marks.read",

    "reports.read",

    "documents.read",
    "documents.manage",

    "notifications.read",

    "calendar.read",
  ],

  /*
   * Librarian:
   * library catalogue and circulation.
   */
  LIBRARIAN: [
    "students.read",
    "users.read",

    "library.read",
    "library.borrow",
    "library.manage",

    "documents.read",

    "notifications.read",

    "reports.read",
  ],

  /*
   * Placement:
   * placement operations. Placement-specific CRUD permissions will be
   * expanded with the placement module implementation.
   */
  PLACEMENT: [
    "students.read",
    "reports.read",
    "notifications.read",
    "documents.read",
    "calendar.read",
  ],

  /*
   * IT:
   * technical administration. IT does not inherit ERP specialist authority.
   */
  IT: [
    "users.read",
    "users.update",

    "reports.read",
    "audit.read",

    "notifications.read",
    "documents.read",
  ],

  /*
   * CMS is completely isolated from ERP authority.
   */
  CMS: [
    "site.manage",
  ],

  /*
   * Student:
   * self-service only.
   */
  STUDENT: [
    ...STUDENT_SELF,
  ],

  /*
   * Parent:
   * linked-child read access.
   */
  PARENT: [
    "attendance.read",
    "assignments.read",
    "marks.read",

    ...ACADEMIC_READ,

    "fees.read",
    "results.read",

    "parent-portal.read",

    "notifications.read",
    "documents.read",

    "calendar.read",

    "lms.read",
  ],

  /*
   * Student Club President:
   * club workspace only. This role does not grant institutional Accounts,
   * HR, admissions, examination or academic-management authority.
   */
  CLUB_PRESIDENT: [
    "notifications.read",
    "documents.read",
    "calendar.read",
    "reports.read",
  ],

  /*
   * -----------------------------------------------------------------------
   * LEGACY COMPATIBILITY
   * -----------------------------------------------------------------------
   *
   * Existing installations may still contain these roles. They are not
   * included in SYSTEM_ROLE_NAMES and therefore are not the roles offered
   * by the new authority model.
   */

  MANAGEMENT: [
    ...LEADERSHIP_READ,

    "leave.approve",

    "fees.approve",
    "fees.reconcile",

    "attendance.approve",
    "attendance.lock",

    "registration.approve",
    "promotions.approve",

    "certificates.issue",

    "exams.approve",
    "exams.revaluate",

    "operations.read",

    "audit.read",
  ],

  STAFF: [
    "users.read",
    "students.read",

    ...ACADEMIC_READ,

    "timetable.read",
    "timetable.manage",

    "notices.read",
    "notices.manage",

    "exams.read",

    "fees.read",
    "fees.manage",
    "fees.pay",

    "parent-links.read",
    "parent-links.manage",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "admissions.read",
    "admissions.manage",

    "leave.apply",

    "library.read",
    "library.borrow",
    "library.manage",

    "calendar.read",

    "registration.read",

    "promotions.read",

    "certificates.read",

    "imports.manage",

    "exams.invigilate",

    "fees.refund",
    "fees.reconcile",

    "operations.read",
    "operations.manage",

    "maintenance.raise",

    "campuses.read",
  ],
};

export function normalizeRoleName(
  role: string
): KnownRoleName | string {
  return (
    ROLE_ALIASES[
      role as LegacyRoleName
    ] ?? role
  );
}

export function getCanonicalRoleNames(
  roles: readonly string[]
): SystemRoleName[] {
  const result =
    new Set<SystemRoleName>();

  for (const role of roles) {
    const normalized =
      normalizeRoleName(role);

    if (
      (
        SYSTEM_ROLE_NAMES as
          readonly string[]
      ).includes(normalized)
    ) {
      result.add(
        normalized as SystemRoleName
      );
    }
  }

  return [...result];
}

export function highestRank(
  roles: readonly string[]
): number {
  return roles.reduce(
    (maximum, role) => {
      const normalized =
        normalizeRoleName(
          role
        ) as KnownRoleName;

      return Math.max(
        maximum,
        ROLE_RANK[normalized] ?? 0
      );
    },
    0
  );
}

/**
 * Strict authority comparison.
 *
 * Equal rank does not outrank.
 */
export function outranks(
  approverRoles: readonly string[],
  applicantRoles: readonly string[]
): boolean {
  return (
    highestRank(
      approverRoles
    ) >
    highestRank(
      applicantRoles
    )
  );
}

export function getRolePermissions(
  role: string
): PermissionKey[] {
  const normalized =
    normalizeRoleName(
      role
    ) as KnownRoleName;

  return [
    ...(ROLE_PERMISSIONS[
      normalized
    ] ?? []),
  ];
}

export function roleHasPermission(
  role: string,
  permission: string
): permission is PermissionKey {
  return getRolePermissions(
    role
  ).includes(
    permission as PermissionKey
  );
}

export function rolesHavePermission(
  roles: readonly string[],
  permission: string
): boolean {
  return roles.some(
    (role) =>
      roleHasPermission(
        role,
        permission
      )
  );
}

export function getEffectivePermissions(
  roles: readonly string[]
): PermissionKey[] {
  const permissions =
    new Set<PermissionKey>();

  for (const role of roles) {
    for (const permission of getRolePermissions(
      role
    )) {
      permissions.add(
        permission
      );
    }
  }

  return [...permissions];
}

export const PLATFORM_ONLY_PERMISSIONS: PermissionKey[] = [
  "institutions.manage",
  "plans.manage",
];

export function isPlatformPermission(
  permission: string
): permission is PermissionKey {
  return PLATFORM_ONLY_PERMISSIONS.includes(
    permission as PermissionKey
  );
}

export function isSystemRole(
  value: string
): value is SystemRoleName {
  return (
    SYSTEM_ROLE_NAMES as
      readonly string[]
  ).includes(value);
}

export function isLegacyRole(
  value: string
): value is LegacyRoleName {
  return (
    LEGACY_ROLE_NAMES as
      readonly string[]
  ).includes(value);
}
