/**
 * ACADLYX — canonical RBAC configuration.
 *
 * Single source of truth for system roles, grantable permissions and the
 * default role -> permission matrix. prisma/seed.ts, prisma/seedAdmin.ts,
 * institution provisioning and the startup RBAC sync all import from here.
 *
 * Permissions are coarse capabilities. They are ONE of three gates:
 *   entitlement (tenant feature)  +  permission (this file)  +  data scope
 * Resource-level scope (tenant, department, ownership, parent-child link)
 * is always enforced again inside services. Never trust the frontend.
 */

export const PERMISSIONS = [
  { key: "users.read", module: "users", description: "View users" },
  { key: "users.create", module: "users", description: "Create users" },
  { key: "users.update", module: "users", description: "Update users" },
  { key: "users.delete", module: "users", description: "Delete or deactivate users" },
  { key: "students.read", module: "students", description: "View students" },
  { key: "students.create", module: "students", description: "Create students" },
  { key: "students.update", module: "students", description: "Update students" },
  { key: "attendance.read", module: "attendance", description: "View attendance" },
  { key: "attendance.mark", module: "attendance", description: "Mark attendance" },
  { key: "assignments.read", module: "assignments", description: "View assignments" },
  { key: "assignments.create", module: "assignments", description: "Create assignments" },
  { key: "assignments.update", module: "assignments", description: "Edit or publish assignments" },
  { key: "assignments.review", module: "assignments", description: "Review or grade assignments" },
  { key: "assignments.submit", module: "assignments", description: "Submit assignment work" },
  { key: "marks.read", module: "marks", description: "View academic marks" },
  { key: "marks.enter", module: "marks", description: "Enter academic marks" },
  { key: "site.manage", module: "site", description: "Manage the public institutional website" },
  { key: "imports.manage", module: "imports", description: "Import institutional data from spreadsheets" },
  { key: "reports.read", module: "reports", description: "View reports" },
  { key: "intelligence.read", module: "intelligence", description: "View institutional intelligence" },
  { key: "institutions.manage", module: "institutions", description: "Manage institutions at platform level" },
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
  { key: "course-offerings.delete", module: "academics", description: "Close or deactivate course offerings" },
  { key: "timetable.read", module: "timetable", description: "View timetables" },
  { key: "timetable.manage", module: "timetable", description: "Create and change timetable entries" },
  { key: "notices.read", module: "notices", description: "View notice administration" },
  { key: "notices.manage", module: "notices", description: "Publish and manage notices" },
  { key: "exams.read", module: "exams", description: "View examinations" },
  { key: "exams.manage", module: "exams", description: "Create examinations and enter results" },
  { key: "results.read", module: "exams", description: "View exam results, grades, SGPA and CGPA within scope" },
  { key: "fees.read", module: "fees", description: "View fee invoices within scope" },
  { key: "fees.manage", module: "fees", description: "Manage fee heads, structures and invoices" },
  { key: "fees.pay", module: "fees", description: "Record fee payments and issue receipts" },
  { key: "parent-links.read", module: "parent-portal", description: "View parent-student links" },
  { key: "parent-links.manage", module: "parent-portal", description: "Manage parent-student links" },
  { key: "parent-portal.read", module: "parent-portal", description: "Use the linked-student portal views" },
  { key: "notifications.read", module: "notifications", description: "Read own notifications" },
  { key: "notifications.manage", module: "notifications", description: "Send notifications to users in scope" },
  { key: "documents.read", module: "documents", description: "View documents within scope" },
  { key: "documents.manage", module: "documents", description: "Upload and remove documents" },
  { key: "admissions.read", module: "admissions", description: "View admission applications" },
  { key: "admissions.manage", module: "admissions", description: "Process admission applications" },
  { key: "hr.read", module: "hr", description: "View employee records" },
  { key: "hr.manage", module: "hr", description: "Manage employee records" },
  { key: "leave.apply", module: "leave", description: "Apply for leave" },
  { key: "leave.read", module: "leave", description: "View leave requests within scope" },
  { key: "leave.approve", module: "leave", description: "Approve or reject leave requests within authority" },
  { key: "leave.manage", module: "leave", description: "Manage leave types" },
  { key: "library.read", module: "library", description: "Browse the library catalogue" },
  { key: "library.borrow", module: "library", description: "View own library loans" },
  { key: "library.manage", module: "library", description: "Manage catalogue and circulation" },
  { key: "calendar.read", module: "calendar", description: "View the academic calendar" },
  { key: "calendar.manage", module: "calendar", description: "Manage the academic calendar" },
  { key: "registration.submit", module: "registration", description: "Register for course offerings" },
  { key: "registration.read", module: "registration", description: "View course registrations within scope" },
  { key: "registration.approve", module: "registration", description: "Approve course registrations within scope" },
  { key: "promotions.read", module: "promotions", description: "View promotion and transfer requests" },
  { key: "promotions.manage", module: "promotions", description: "Raise promotion and transfer requests" },
  { key: "promotions.approve", module: "promotions", description: "Approve promotion and transfer requests" },
  { key: "certificates.request", module: "certificates", description: "Request certificates" },
  { key: "certificates.read", module: "certificates", description: "View certificate requests within scope" },
  { key: "certificates.issue", module: "certificates", description: "Issue certificates" },
  { key: "audit.read", module: "audit", description: "View the institution audit trail" },

  // Examinations control (beyond the existing exams.read/exams.manage)
  { key: "exams.approve", module: "exams", description: "Approve, lock and publish examination marks" },
  { key: "exams.invigilate", module: "exams", description: "Record examination attendance and incidents" },
  { key: "exams.revaluate", module: "exams", description: "Request or decide revaluation" },

  // Attendance governance
  { key: "attendance.correct", module: "attendance", description: "Raise attendance correction requests" },
  { key: "attendance.approve", module: "attendance", description: "Approve or reject attendance corrections" },
  { key: "attendance.lock", module: "attendance", description: "Finalise and lock attendance" },
  { key: "attendance.policy", module: "attendance", description: "Configure attendance shortage policy" },

  // Learning management
  { key: "lms.read", module: "lms", description: "View course content and quizzes" },
  { key: "lms.manage", module: "lms", description: "Author modules, lessons, question banks and quizzes" },
  { key: "lms.attempt", module: "lms", description: "Attempt quizzes and record lesson progress" },
  { key: "lms.grade", module: "lms", description: "Grade quiz attempts" },

  // Fee lifecycle beyond fees.manage
  { key: "fees.refund", module: "fees", description: "Request refunds" },
  { key: "fees.approve", module: "fees", description: "Approve concessions and refunds" },
  { key: "fees.reconcile", module: "fees", description: "Reconcile payments against provider statements" },

  // Institution operations
  { key: "operations.read", module: "operations", description: "View assets, facilities and maintenance" },
  { key: "operations.manage", module: "operations", description: "Manage assets, facilities and maintenance" },
  { key: "maintenance.raise", module: "operations", description: "Raise a maintenance request" },

  /*
   * Campuses.
   *
   * campus.routes.ts already enforced these keys, but they were never
   * declared, so only SUPER_ADMIN (which bypasses the check) could
   * reach the endpoints and no institution could manage its own
   * campuses. Declaring them makes the existing routes usable.
   */
  { key: "campuses.read", module: "campuses", description: "View campuses" },
  { key: "campuses.create", module: "campuses", description: "Create a campus" },
  { key: "campuses.update", module: "campuses", description: "Update a campus" },
  { key: "campuses.delete", module: "campuses", description: "Remove a campus" },

  // Platform SaaS administration
  { key: "plans.manage", module: "saas", description: "Manage subscription plans and tenant lifecycle" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const SYSTEM_ROLE_NAMES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
  "STAFF",
  "STUDENT",
  "PARENT",
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/**
 * Authority hierarchy:
 * SUPER_ADMIN > INSTITUTION_ADMIN > DIRECTOR = MANAGEMENT > HOD >
 * FACULTY = STAFF > STUDENT = PARENT
 */
export const ROLE_RANK: Record<SystemRoleName, number> = {
  SUPER_ADMIN: 100,
  INSTITUTION_ADMIN: 90,
  DIRECTOR: 70,
  MANAGEMENT: 70,
  HOD: 60,
  FACULTY: 40,
  STAFF: 40,
  STUDENT: 10,
  PARENT: 10,
};

export function highestRank(roles: readonly string[]): number {
  return roles.reduce(
    (max, role) => Math.max(max, ROLE_RANK[role as SystemRoleName] ?? 0),
    0
  );
}

/** True when every role of the approver strictly outranks the applicant. */
export function outranks(
  approverRoles: readonly string[],
  applicantRoles: readonly string[]
): boolean {
  return highestRank(approverRoles) > highestRank(applicantRoles);
}

const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map(
  (permission) => permission.key
);

const ACADEMIC_READ: PermissionKey[] = [
  "departments.read",
  "programs.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

const LEADERSHIP: PermissionKey[] = [
  "users.read",
  "students.read",
  "attendance.read",
  "assignments.read",
  "marks.read",
  "reports.read",
  "intelligence.read",
  "site.manage",
  "imports.manage",
  ...ACADEMIC_READ,
  "timetable.read",
  "notices.read",
  "notices.manage",
  "exams.read",
  "results.read",
  "fees.read",
  "parent-links.read",
  "parent-portal.read",
  "notifications.read",
  "notifications.manage",
  "documents.read",
  "admissions.read",
  "admissions.manage",
  "hr.read",
  "leave.apply",
  "leave.read",
  "leave.approve",
  "library.read",
  "library.borrow",
  "calendar.read",
  "calendar.manage",
  "registration.read",
  "promotions.read",
  "promotions.approve",
  "certificates.read",
  "certificates.issue",
  "exams.approve",
  "exams.revaluate",
  "attendance.approve",
  "attendance.lock",
  "attendance.policy",
  "lms.read",
  "fees.approve",
  "fees.reconcile",
  "operations.read",
  "operations.manage",
  "maintenance.raise",
  "campuses.read",
];

/**
 * Default permissions for every built-in role.
 *
 * Permission checks alone never establish data ownership: services also
 * enforce tenant, department, student, parent-child and record ownership.
 */
export const ROLE_PERMISSIONS: Record<SystemRoleName, PermissionKey[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],

  // Every capability except the platform-only ones, which belong to
  // Anthropic-style platform operations rather than a tenant.
  INSTITUTION_ADMIN: ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== "institutions.manage" && permission !== "plans.manage"
  ),

  DIRECTOR: [...LEADERSHIP, "audit.read"],

  MANAGEMENT: [...LEADERSHIP],

  HOD: [
    "students.read",
    "attendance.read",
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
    "exams.manage",
    "results.read",
    "parent-portal.read",
    "notifications.read",
    "notifications.manage",
    "documents.read",
    "leave.apply",
    "leave.read",
    "leave.approve",
    "library.read",
    "library.borrow",
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
    "lms.manage",
    "lms.grade",
    "operations.read",
    "maintenance.raise",
    "campuses.read",
  ],

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
    "attendance.approve",
    "lms.read",
    "lms.manage",
    "lms.grade",
    "maintenance.raise",
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

  STUDENT: [
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
  ],

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
};

export function isSystemRole(value: string): value is SystemRoleName {
  return (SYSTEM_ROLE_NAMES as readonly string[]).includes(value);
}

export function getRolePermissions(role: string): PermissionKey[] {
  if (!isSystemRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(
  role: string,
  permission: string
): permission is PermissionKey {
  if (!isSystemRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission as PermissionKey);
}

export function rolesHavePermission(
  roles: readonly string[],
  permission: string
): boolean {
  return roles.some((role) => roleHasPermission(role, permission));
}

export function getEffectivePermissions(
  roles: readonly string[]
): PermissionKey[] {
  const permissions = new Set<PermissionKey>();
  for (const role of roles) {
    for (const permission of getRolePermissions(role)) {
      permissions.add(permission);
    }
  }
  return [...permissions];
}

/** Platform-level permissions are never granted to institution roles. */
export const PLATFORM_ONLY_PERMISSIONS: PermissionKey[] = [
  "institutions.manage",
  "plans.manage",
];

export function isPlatformPermission(
  permission: string
): permission is PermissionKey {
  return PLATFORM_ONLY_PERMISSIONS.includes(permission as PermissionKey);
}
