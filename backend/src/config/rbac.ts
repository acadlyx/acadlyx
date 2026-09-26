/**
 * ACADLYX — canonical RBAC configuration.
 *
 * This file is the single source of truth for:
 *
 *   1. System roles
 *   2. Permission catalogue
 *   3. Default role -> permission assignments
 *   4. Authority rank
 *   5. Legacy role aliases
 *
 * IMPORTANT:
 *
 * Role != permission != scope != workflow authority.
 *
 * A permission only says that a role may perform a class of operation.
 * Services/controllers must still enforce institution, department,
 * program, course, student, ownership and workflow scope.
 *
 * Frontend navigation is never a security boundary.
 */

export const PERMISSIONS = [
  { key: "users.read", module: "users", description: "View users" },
  { key: "users.create", module: "users", description: "Create users" },
  { key: "users.update", module: "users", description: "Update users" },
  { key: "users.delete", module: "users", description: "Delete or deactivate users" },

  { key: "students.read", module: "students", description: "View students within scope" },
  { key: "students.create", module: "students", description: "Create students through institutional student administration" },
  { key: "students.update", module: "students", description: "Update student master records within scope" },

  { key: "attendance.read", module: "attendance", description: "View attendance within scope" },
  { key: "attendance.mark", module: "attendance", description: "Mark attendance for assigned classes" },
  { key: "attendance.correct", module: "attendance", description: "Raise attendance correction requests" },
  { key: "attendance.approve", module: "attendance", description: "Approve attendance corrections within authority" },
  { key: "attendance.lock", module: "attendance", description: "Finalise and lock attendance" },
  { key: "attendance.policy", module: "attendance", description: "Configure attendance policy" },

  { key: "assignments.read", module: "assignments", description: "View assignments within scope" },
  { key: "assignments.create", module: "assignments", description: "Create assignments" },
  { key: "assignments.update", module: "assignments", description: "Edit or publish assignments" },
  { key: "assignments.review", module: "assignments", description: "Review or grade assignments" },
  { key: "assignments.submit", module: "assignments", description: "Submit assignment work" },

  { key: "marks.read", module: "marks", description: "View academic marks within scope" },
  { key: "marks.enter", module: "marks", description: "Enter academic marks for assigned courses" },

  {
    key: "site.manage",
    module: "site",
    description: "Manage public institutional website content",
  },

  { key: "imports.manage", module: "imports", description: "Import institutional data" },
  { key: "reports.read", module: "reports", description: "View reports within scope" },
  { key: "intelligence.read", module: "intelligence", description: "View institutional intelligence" },

  {
    key: "institutions.manage",
    module: "institutions",
    description: "Manage institutions at platform level",
  },

  { key: "departments.read", module: "academics", description: "View departments" },
  { key: "departments.create", module: "academics", description: "Create departments" },
  { key: "departments.update", module: "academics", description: "Update departments" },
  { key: "departments.delete", module: "academics", description: "Deactivate departments" },

  { key: "programs.read", module: "academics", description: "View programs" },
  { key: "programs.create", module: "academics", description: "Create programs" },
  { key: "programs.update", module: "academics", description: "Update programs" },
  { key: "programs.delete", module: "academics", description: "Deactivate programs" },

  { key: "academic-years.read", module: "academics", description: "View academic years" },
  { key: "academic-years.create", module: "academics", description: "Create academic years" },
  { key: "academic-years.update", module: "academics", description: "Update academic years" },

  { key: "semesters.read", module: "academics", description: "View semesters" },
  { key: "semesters.create", module: "academics", description: "Create semesters" },
  { key: "semesters.update", module: "academics", description: "Update semesters" },
  { key: "semesters.delete", module: "academics", description: "Deactivate semesters" },

  { key: "sections.read", module: "academics", description: "View sections" },
  { key: "sections.create", module: "academics", description: "Create sections" },
  { key: "sections.update", module: "academics", description: "Update sections" },
  { key: "sections.delete", module: "academics", description: "Deactivate sections" },

  { key: "courses.read", module: "academics", description: "View courses" },
  { key: "courses.create", module: "academics", description: "Create courses" },
  { key: "courses.update", module: "academics", description: "Update courses" },
  { key: "courses.delete", module: "academics", description: "Deactivate courses" },

  { key: "course-offerings.read", module: "academics", description: "View course offerings" },
  { key: "course-offerings.create", module: "academics", description: "Create course offerings" },
  { key: "course-offerings.update", module: "academics", description: "Update course offerings" },
  { key: "course-offerings.delete", module: "academics", description: "Close course offerings" },

  { key: "timetable.read", module: "timetable", description: "View timetables" },
  { key: "timetable.manage", module: "timetable", description: "Manage timetables" },

  { key: "notices.read", module: "notices", description: "View notices" },
  { key: "notices.manage", module: "notices", description: "Publish and manage notices" },

  { key: "exams.read", module: "exams", description: "View examinations" },
  { key: "exams.manage", module: "exams", description: "Manage examination operations" },
  { key: "exams.approve", module: "exams", description: "Approve, lock and publish examination marks" },
  { key: "exams.invigilate", module: "exams", description: "Record examination attendance and incidents" },
  { key: "exams.revaluate", module: "exams", description: "Handle examination revaluation authority" },

  { key: "results.read", module: "exams", description: "View examination results within scope" },

  { key: "fees.read", module: "fees", description: "View fee records within scope" },
  { key: "fees.manage", module: "fees", description: "Manage fee heads, structures and invoices" },
  { key: "fees.pay", module: "fees", description: "Record fee payments and issue receipts" },
  { key: "fees.refund", module: "fees", description: "Process or request fee refunds" },
  { key: "fees.approve", module: "fees", description: "Approve fee concessions and refunds" },
  { key: "fees.reconcile", module: "fees", description: "Reconcile financial payments" },

  { key: "parent-links.read", module: "parent-portal", description: "View parent-student links" },
  { key: "parent-links.manage", module: "parent-portal", description: "Manage parent-student links" },
  { key: "parent-portal.read", module: "parent-portal", description: "Use linked-student portal views" },

  { key: "notifications.read", module: "notifications", description: "Read own notifications" },
  { key: "notifications.manage", module: "notifications", description: "Send notifications within scope" },

  { key: "documents.read", module: "documents", description: "View documents within scope" },
  { key: "documents.manage", module: "documents", description: "Manage documents within scope" },

  { key: "admissions.read", module: "admissions", description: "View admission applications" },
  { key: "admissions.manage", module: "admissions", description: "Process admission applications" },

  { key: "hr.read", module: "hr", description: "View employee records" },
  { key: "hr.manage", module: "hr", description: "Manage employee records" },

  { key: "leave.apply", module: "leave", description: "Apply for leave" },
  { key: "leave.read", module: "leave", description: "View leave requests within scope" },
  { key: "leave.approve", module: "leave", description: "Approve or reject leave within configured authority" },
  { key: "leave.manage", module: "leave", description: "Manage leave types and leave administration" },

  { key: "library.read", module: "library", description: "Browse library catalogue" },
  { key: "library.borrow", module: "library", description: "Use personal library services" },
  { key: "library.manage", module: "library", description: "Manage library catalogue and circulation" },

  { key: "calendar.read", module: "calendar", description: "View academic calendar" },
  { key: "calendar.manage", module: "calendar", description: "Manage academic calendar" },
  { key: "club.read", module: "clubs", description: "View assigned club within scope" },
  { key: "club.manage", module: "clubs", description: "Manage assigned club within scope" },

  { key: "registration.submit", module: "registration", description: "Submit course registration" },
  { key: "registration.read", module: "registration", description: "View registrations within scope" },
  { key: "registration.approve", module: "registration", description: "Approve course registrations" },

  { key: "promotions.read", module: "promotions", description: "View student movement requests" },
  { key: "promotions.manage", module: "promotions", description: "Create student movement requests" },
  { key: "promotions.approve", module: "promotions", description: "Approve student movement requests" },

  { key: "certificates.request", module: "certificates", description: "Request certificates" },
  { key: "certificates.read", module: "certificates", description: "View certificate requests" },
  { key: "certificates.issue", module: "certificates", description: "Issue certificates" },

  { key: "audit.read", module: "audit", description: "View audit trail" },

  { key: "lms.read", module: "lms", description: "View LMS content" },
  { key: "lms.manage", module: "lms", description: "Manage LMS content" },
  { key: "lms.attempt", module: "lms", description: "Attempt LMS assessments" },
  { key: "lms.grade", module: "lms", description: "Grade LMS assessments" },

  { key: "operations.read", module: "operations", description: "View operational records" },
  { key: "operations.manage", module: "operations", description: "Manage operational records" },
  { key: "maintenance.raise", module: "operations", description: "Raise maintenance requests" },

  { key: "campuses.read", module: "campuses", description: "View campuses" },
  { key: "campuses.create", module: "campuses", description: "Create campuses" },
  { key: "campuses.update", module: "campuses", description: "Update campuses" },
  { key: "campuses.delete", module: "campuses", description: "Remove campuses" },

  { key: "plans.manage", module: "saas", description: "Manage platform subscription plans" },
] as const;

export type PermissionKey =
  (typeof PERMISSIONS)[number]["key"];

/**
 * Canonical application roles. Legacy MANAGEMENT/STAFF values are accepted
 * only as database/input compatibility aliases and are never canonical roles.
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
 * Roles that may exist only at platform level.
 */
export const PLATFORM_ROLES = [
  "SUPER_ADMIN",
] as const;

/**
 * Roles that are institution scoped.
 */
export const INSTITUTION_ROLES = SYSTEM_ROLE_NAMES.filter(
  (role) =>
    role !== "SUPER_ADMIN"
) as readonly SystemRoleName[];

/**
 * Legacy aliases.
 *
 * Existing production records are not silently destroyed.
 * New application logic should use the canonical role names.
 */
export const LEGACY_ROLE_ALIASES: Record<
  string,
  SystemRoleName
> = {
  MANAGEMENT: "CHAIRMAN",
  STAFF: "ACCOUNTS",
};

export function normalizeRoleName(
  role: string
): SystemRoleName | null {
  const canonicalAlias = LEGACY_ROLE_ALIASES[role];
  if (canonicalAlias) return canonicalAlias;

  if (SYSTEM_ROLE_NAMES.includes(role as SystemRoleName)) {
    return role as SystemRoleName;
  }

  return null;
}

export function isSupportedRole(
  role: string
): boolean {
  return (
    normalizeRoleName(
      role
    ) !== null
  );
}

export function isPlatformRole(
  role: string
): boolean {
  return (
    normalizeRoleName(
      role
    ) === "SUPER_ADMIN"
  );
}

export function isInstitutionRole(
  role: string
): boolean {
  const normalized =
    normalizeRoleName(
      role
    );

  return Boolean(
    normalized &&
      normalized !== "SUPER_ADMIN"
  );
}

export function getCanonicalRoleNames(
  roles: readonly string[]
): SystemRoleName[] {
  const result =
    new Set<SystemRoleName>();

  for (
    const role of roles
  ) {
    const normalized =
      normalizeRoleName(
        role
      );

    if (normalized) {
      result.add(
        normalized
      );
    }
  }

  return [
    ...result,
  ];
}


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
  "students.read",
  "attendance.read",
  "assignments.read",
  "marks.read",
  "reports.read",
  "intelligence.read",
  "users.read",

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
  "operations.read",
  "campuses.read",
];

/**
 * Default permissions by role.
 *
 * IMPORTANT:
 *
 * SUPER_ADMIN deliberately does NOT receive every institutional permission.
 *
 * Platform administration and institution administration are separate
 * authority domains.
 *
 * Super Admin can provision institutions, manage platform security and
 * designate institution administrators/CMS users, but does not become the
 * operational Accounts/HR/Faculty/Student/etc. operator merely by virtue
 * of being Super Admin.
 */
export const ROLE_PERMISSIONS: Record<
  SystemRoleName,
  PermissionKey[]
> = {
  SUPER_ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",

    "institutions.manage",
    "plans.manage",

    "site.manage",

    "reports.read",
    "audit.read",
  ],

  INSTITUTION_ADMIN: [
    /*
     * Institutional administration only.
     *
     * Deliberately excluded:
     * - fees / payments
     * - assignments / marks
     * - attendance operations
     * - examinations / result processing
     * - HR
     * - admissions processing
     * - library operations
     * - placement operations
     * - specialist financial / academic operations
     *
     * Institution Admin owns people, institutional structure and
     * general administrative configuration.
     */
    "users.read",
    "users.create",
    "users.update",
    "users.delete",

    "students.read",
    "students.create",
    "students.update",

    ...ACADEMIC_READ,

    "departments.create",
    "departments.update",
    "departments.delete",

    "programs.create",
    "programs.update",
    "programs.delete",

    "academic-years.create",
    "academic-years.update",

    "semesters.create",
    "semesters.update",
    "semesters.delete",

    "sections.create",
    "sections.update",
    "sections.delete",

    "courses.create",
    "courses.update",
    "courses.delete",

    "course-offerings.create",
    "course-offerings.update",
    "course-offerings.delete",

    "notices.read",
    "notices.manage",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "calendar.read",
    "calendar.manage",

    "parent-links.read",
    "parent-links.manage",

    "operations.read",
    "operations.manage",
    "maintenance.raise",

    "campuses.read",
    "campuses.create",
    "campuses.update",
    "campuses.delete",
  ],

  CHAIRMAN: [
    ...LEADERSHIP_READ,

    "reports.read",
    "intelligence.read",

    "fees.read",

    "exams.read",
    "results.read",

    "operations.read",

    "audit.read",
  ],

  DIRECTOR: [
    ...LEADERSHIP_READ,

    "reports.read",
    "intelligence.read",


    "registration.read",
    "registration.approve",

    "promotions.read",
    "promotions.approve",

    "certificates.read",
    "certificates.issue",

    "exams.read",
    "exams.approve",
    "exams.revaluate",

    "attendance.read",
    "attendance.approve",
    "attendance.lock",

    "fees.read",
    "fees.approve",

    "operations.read",

    "audit.read",
  ],

  DEAN: [
    "students.read",
    "attendance.read",
    "assignments.read",
    "assignments.review",
    "marks.read",
    "reports.read",
    "intelligence.read",

    ...ACADEMIC_READ,

    "sections.read",
    "course-offerings.read",
    "timetable.read",

    "notices.read",
    "notices.manage",

    "exams.read",
    "results.read",

    "parent-portal.read",

    "notifications.read",
    "documents.read",

    "leave.read",

    "calendar.read",

    "registration.read",
    "registration.approve",

    "promotions.read",
    "promotions.approve",

    "certificates.read",

    "attendance.approve",
    "attendance.lock",

    "operations.read",
  ],

  REGISTRAR: [
    "students.read",
    "students.update",

    "users.read",

    ...ACADEMIC_READ,

    "departments.create",
    "departments.update",

    "programs.create",
    "programs.update",

    "academic-years.create",
    "academic-years.update",

    "semesters.create",
    "semesters.update",

    "sections.create",
    "sections.update",

    "courses.create",
    "courses.update",

    "course-offerings.create",
    "course-offerings.update",

    "registration.read",
    "registration.approve",

    "promotions.read",
    "promotions.manage",
    "promotions.approve",

    "certificates.read",
    "certificates.issue",

    "results.read",

    "exams.read",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "calendar.read",
    "calendar.manage",

    "audit.read",
  ],

  HOD: [
    "students.read",

    "attendance.read",
    "attendance.approve",
    "attendance.lock",

    "assignments.read",
    "assignments.review",

    "marks.read",

    "reports.read",
    "intelligence.read",

    "departments.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",
    "sections.read",
    "sections.update",
    "courses.read",
    "course-offerings.read",
    "course-offerings.update",

    "timetable.read",
    "timetable.manage",

    "notices.read",
    "notices.manage",

    "exams.read",
    "results.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",

    "leave.read",

    "library.read",
    "library.borrow",

    "calendar.read",

    "registration.read",
    "registration.approve",

    "promotions.read",
    "promotions.manage",

    "lms.read",
    "lms.manage",
    "lms.grade",

    "operations.read",
    "maintenance.raise",
  ],

  FACULTY: [
    "students.read",

    "attendance.read",
    "attendance.mark",
    "attendance.correct",

    "assignments.read",
    "assignments.create",
    "assignments.update",
    "assignments.review",

    "marks.read",
    "marks.enter",

    "courses.read",
    "course-offerings.read",
    "sections.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",

    "timetable.read",

    "exams.read",
    "exams.invigilate",

    "results.read",

    "notifications.read",
    "documents.read",

    "leave.apply",

    "library.read",
    "library.borrow",

    "calendar.read",

    "lms.read",
    "lms.manage",
    "lms.grade",

    "maintenance.raise",
  ],

  ACCOUNTS: [
    "students.read",

    "fees.read",
    "fees.manage",
    "fees.pay",
    "fees.refund",
    "fees.approve",
    "fees.reconcile",

    "reports.read",

    "users.read",

    "notifications.read",

    "documents.read",

    "calendar.read",

    "operations.read",
  ],

  HR: [
    "users.read",
    "users.create",
    "users.update",

    "hr.read",
    "hr.manage",

    "leave.read",
    "leave.approve",
    "leave.manage",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "audit.read",
  ],

  ADMISSIONS: [
    "admissions.read",
    "admissions.manage",

    "students.read",

    "documents.read",
    "documents.manage",

    "notifications.read",
    "notifications.manage",

    "reports.read",

    "calendar.read",
  ],

  EXAMINATION: [
    "students.read",

    "exams.read",
    "exams.manage",
    "exams.approve",
    "exams.invigilate",
    "exams.revaluate",

    "marks.read",

    "results.read",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",

    "audit.read",
  ],

  LIBRARIAN: [
    "students.read",

    "library.read",
    "library.borrow",
    "library.manage",

    "notifications.read",

    "reports.read",

    "documents.read",

    "maintenance.raise",
  ],

  PLACEMENT: [
    "students.read",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "calendar.read",
  ],

  IT: [
    "users.read",
    "users.update",

    "reports.read",
    "audit.read",

    "operations.read",
    "operations.manage",

    "notifications.read",
    "notifications.manage",

    "documents.read",
  ],

  CMS: [
    "site.manage",
  ],

  STUDENT: [
    "attendance.read",

    "assignments.read",
    "assignments.submit",

    "marks.read",

    "courses.read",
    "course-offerings.read",
    "sections.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",

    "timetable.read",

    "exams.read",
    "results.read",

    "fees.read",

    "notifications.read",

    "documents.read",

    "leave.apply",

    "library.read",
    "library.borrow",

    "calendar.read",

    "registration.submit",

    "certificates.request",

    "attendance.correct",

    "lms.read",
    "lms.attempt",

    "maintenance.raise",
  ],

  PARENT: [
    "attendance.read",

    "assignments.read",

    "marks.read",

    "courses.read",
    "course-offerings.read",
    "sections.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",

    "timetable.read",

    "fees.read",

    "results.read",

    "parent-portal.read",

    "notifications.read",

    "documents.read",

    "calendar.read",

    "lms.read",
  ],

  CLUB_PRESIDENT: [
    "club.read",
    "club.manage",
    "calendar.read",
  ],
};

export const ROLE_RANK: Record<
  SystemRoleName,
  number
> = {
  SUPER_ADMIN: 100,

  INSTITUTION_ADMIN: 90,

  CHAIRMAN: 80,

  DIRECTOR: 75,

  DEAN: 65,

  REGISTRAR: 65,

  HOD: 55,

  ACCOUNTS: 45,
  HR: 45,
  ADMISSIONS: 45,
  EXAMINATION: 45,
  LIBRARIAN: 45,
  PLACEMENT: 45,
  IT: 45,

  FACULTY: 40,

  CMS: 20,

  CLUB_PRESIDENT: 20,

  STUDENT: 10,
  PARENT: 10,

};

export function highestRoleRank(
  roles: readonly string[]
): number {
  return roles.reduce(
    (highest, role) => {
      const normalized =
        normalizeRoleName(
          role
        );

      if (!normalized) {
        return highest;
      }

      return Math.max(
        highest,
        ROLE_RANK[
          normalized
        ] ?? 0
      );
    },
    0
  );
}

export function outranks(
  approverRoles: readonly string[],
  applicantRoles: readonly string[]
): boolean {
  return (
    highestRoleRank(
      approverRoles
    ) >
    highestRoleRank(
      applicantRoles
    )
  );
}

export function getRolePermissions(
  roleName: string
): PermissionKey[] {
  const normalized =
    normalizeRoleName(
      roleName
    );

  if (!normalized) {
    return [];
  }

  return [
    ...(
      ROLE_PERMISSIONS[
        normalized
      ] ?? []
    ),
  ];
}

export function getEffectivePermissions(
  roles: readonly string[]
): PermissionKey[] {
  const permissions =
    new Set<PermissionKey>();

  for (
    const role of roles
  ) {
    for (
      const permission of
        getRolePermissions(
          role
        )
    ) {
      permissions.add(
        permission
      );
    }
  }

  return [
    ...permissions,
  ];
}

export function hasRole(
  roles: readonly string[],
  role: SystemRoleName
): boolean {
  return roles.some(
    (candidate) =>
      normalizeRoleName(
        candidate
      ) === role
  );
}

export function hasPermission(
  roles: readonly string[],
  permission: PermissionKey
): boolean {
  return getEffectivePermissions(
    roles
  ).includes(
    permission
  );
}

/**
 * Platform-only permissions.
 *
 * These must never be inherited by institution roles.
 */
export const PLATFORM_PERMISSIONS: PermissionKey[] = [
  "institutions.manage",
  "plans.manage",
];

export function isPlatformPermission(
  permission: PermissionKey
): boolean {
  return PLATFORM_PERMISSIONS.includes(
    permission
  );
}

/**
 * Institution permissions that must never be granted merely because
 * somebody has the Super Admin role.
 *
 * This is intentionally separate from platform permissions.
 */
export const INSTITUTION_OPERATION_PERMISSIONS: PermissionKey[] = [
  "students.create",
  "students.update",

  "fees.manage",
  "fees.pay",
  "fees.refund",
  "fees.approve",
  "fees.reconcile",

  "hr.manage",

  "leave.approve",
  "leave.manage",

  "admissions.manage",

  "exams.manage",
  "exams.approve",
  "exams.invigilate",
  "exams.revaluate",

  "library.manage",

  "registration.approve",

  "promotions.approve",

  "certificates.issue",

  "operations.manage",
];

/**
 * Returns only canonical roles.
 */
export function getCanonicalRoles(
  roles: readonly string[]
): SystemRoleName[] {
  return getCanonicalRoleNames(
    roles
  );
}
